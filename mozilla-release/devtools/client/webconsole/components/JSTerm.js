/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const {Utils: WebConsoleUtils} = require("devtools/client/webconsole/utils");
const Services = require("Services");

loader.lazyServiceGetter(this, "clipboardHelper",
                         "@mozilla.org/widget/clipboardhelper;1",
                         "nsIClipboardHelper");
loader.lazyRequireGetter(this, "defer", "devtools/shared/defer");
loader.lazyRequireGetter(this, "Debugger", "Debugger");
loader.lazyRequireGetter(this, "EventEmitter", "devtools/shared/event-emitter");
loader.lazyRequireGetter(this, "AutocompletePopup", "devtools/client/shared/autocomplete-popup");
loader.lazyRequireGetter(this, "PropTypes", "devtools/client/shared/vendor/react-prop-types");
loader.lazyRequireGetter(this, "gDevTools", "devtools/client/framework/devtools", true);
loader.lazyRequireGetter(this, "KeyCodes", "devtools/client/shared/keycodes", true);
loader.lazyRequireGetter(this, "Editor", "devtools/client/sourceeditor/editor");
loader.lazyRequireGetter(this, "Telemetry", "devtools/client/shared/telemetry");
loader.lazyRequireGetter(this, "processScreenshot", "devtools/shared/webconsole/screenshot-helper");

const l10n = require("devtools/client/webconsole/webconsole-l10n");

const HELP_URL = "https://developer.mozilla.org/docs/Tools/Web_Console/Helpers";

function gSequenceId() {
  return gSequenceId.n++;
}
gSequenceId.n = 0;

// React & Redux
const { Component } = require("devtools/client/shared/vendor/react");
const dom = require("devtools/client/shared/vendor/react-dom-factories");
const { connect } = require("devtools/client/shared/vendor/react-redux");

// History Modules
const {
  getHistory,
  getHistoryValue
} = require("devtools/client/webconsole/selectors/history");
const historyActions = require("devtools/client/webconsole/actions/history");

// Constants used for defining the direction of JSTerm input history navigation.
const {
  HISTORY_BACK,
  HISTORY_FORWARD
} = require("devtools/client/webconsole/constants");

/**
 * Create a JSTerminal (a JavaScript command line). This is attached to an
 * existing HeadsUpDisplay (a Web Console instance). This code is responsible
 * with handling command line input and code evaluation.
 *
 * @constructor
 * @param object webConsoleFrame
 *        The WebConsoleFrame object that owns this JSTerm instance.
 */
class JSTerm extends Component {
  static get propTypes() {
    return {
      // Append new executed expression into history list (action).
      appendToHistory: PropTypes.func.isRequired,
      // Remove all entries from the history list (action).
      clearHistory: PropTypes.func.isRequired,
      // Returns previous or next value from the history
      // (depending on direction argument).
      getValueFromHistory: PropTypes.func.isRequired,
      // History of executed expression (state).
      history: PropTypes.object.isRequired,
      // Console object.
      hud: PropTypes.object.isRequired,
      // Handler for clipboard 'paste' event (also used for 'drop' event, callback).
      onPaste: PropTypes.func,
      codeMirrorEnabled: PropTypes.bool,
      // Update position in the history after executing an expression (action).
      updatePlaceHolder: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    const {
      hud,
    } = props;

    this.hud = hud;
    this.hudId = this.hud.hudId;

    /**
     * Stores the data for the last completion.
     * @type object
     */
    this.lastCompletion = { value: null };

    this._keyPress = this._keyPress.bind(this);
    this._inputEventHandler = this._inputEventHandler.bind(this);
    this._focusEventHandler = this._focusEventHandler.bind(this);
    this._blurEventHandler = this._blurEventHandler.bind(this);

    this.SELECTED_FRAME = -1;

    /**
     * Array that caches the user input suggestions received from the server.
     * @private
     * @type array
     */
    this._autocompleteCache = null;

    /**
     * The input that caused the last request to the server, whose response is
     * cached in the _autocompleteCache array.
     * @private
     * @type string
     */
    this._autocompleteQuery = null;

    /**
     * The frameActorId used in the last autocomplete query. Whenever this changes
     * the autocomplete cache must be invalidated.
     * @private
     * @type string
     */
    this._lastFrameActorId = null;

    /**
     * Last input value.
     * @type string
     */
    this.lastInputValue = "";

    /**
     * Tells if the input node changed since the last focus.
     *
     * @private
     * @type boolean
     */
    this._inputChanged = false;

    /**
     * Tells if the autocomplete popup was navigated since the last open.
     *
     * @private
     * @type boolean
     */
    this._autocompletePopupNavigated = false;

    this.autocompletePopup = null;
    this.inputNode = null;
    this.completeNode = null;

    this.COMPLETE_FORWARD = 0;
    this.COMPLETE_BACKWARD = 1;
    this.COMPLETE_HINT_ONLY = 2;
    this.COMPLETE_PAGEUP = 3;
    this.COMPLETE_PAGEDOWN = 4;

    this._telemetry = new Telemetry();

    EventEmitter.decorate(this);
    hud.jsterm = this;
  }

  componentDidMount() {
    const autocompleteOptions = {
      onSelect: this.onAutocompleteSelect.bind(this),
      onClick: this.acceptProposedCompletion.bind(this),
      listId: "webConsole_autocompletePopupListBox",
      position: "top",
      theme: "auto",
      autoSelect: true
    };

    const doc = this.hud.document;
    const toolbox = gDevTools.getToolbox(this.hud.owner.target);
    const tooltipDoc = toolbox ? toolbox.doc : doc;
    // The popup will be attached to the toolbox document or HUD document in the case
    // such as the browser console which doesn't have a toolbox.
    this.autocompletePopup = new AutocompletePopup(tooltipDoc, autocompleteOptions);

    this.inputBorderSize = this.inputNode
      ? this.inputNode.getBoundingClientRect().height - this.inputNode.clientHeight
      : 0;

    // Update the character width and height needed for the popup offset
    // calculations.
    this._updateCharSize();

    if (this.props.codeMirrorEnabled) {
      if (this.node) {
        this.editor = new Editor({
          autofocus: true,
          enableCodeFolding: false,
          gutters: [],
          lineWrapping: true,
          mode: Editor.modes.js,
          styleActiveLine: false,
          tabIndex: "0",
          viewportMargin: Infinity,
          extraKeys: {
            "Enter": (e, cm) => {
              if (!this.autocompletePopup.isOpen && (
                e.shiftKey || !Debugger.isCompilableUnit(this.getInputValue())
              )) {
                // shift return or incomplete statement
                return "CodeMirror.Pass";
              }

              this.execute();
              return null;
            },
          },
        });
        this.editor.appendToLocalElement(this.node);
      }
    } else if (this.inputNode) {
      this.inputNode.addEventListener("keypress", this._keyPress);
      this.inputNode.addEventListener("input", this._inputEventHandler);
      this.inputNode.addEventListener("keyup", this._inputEventHandler);
      this.inputNode.addEventListener("focus", this._focusEventHandler);
      this.focus();
    }

    this.hud.window.addEventListener("blur", this._blurEventHandler);
    this.lastInputValue && this.setInputValue(this.lastInputValue);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // XXX: For now, everything is handled in an imperative way and we
    // only want React to do the initial rendering of the component.
    // This should be modified when the actual refactoring will take place.
    return false;
  }

  /**
   * Getter for the element that holds the messages we display.
   * @type Element
   */
  get outputNode() {
    return this.hud.outputNode;
  }

  /**
   * Getter for the debugger WebConsoleClient.
   * @type object
   */
  get webConsoleClient() {
    return this.hud.webConsoleClient;
  }

  focus() {
    if (this.editor) {
      this.editor.focus();
    } else if (this.inputNode && !this.inputNode.getAttribute("focused")) {
      this.inputNode.focus();
    }
  }

  /**
   * The JavaScript evaluation response handler.
   *
   * @private
   * @param function [callback]
   *        Optional function to invoke when the evaluation result is added to
   *        the output.
   * @param object response
   *        The message received from the server.
   */
  async _executeResultCallback(callback, response) {
    if (!this.hud) {
      return;
    }
    if (response.error) {
      console.error("Evaluation error " + response.error + ": " + response.message);
      return;
    }
    let errorMessage = response.exceptionMessage;

    // Wrap thrown strings in Error objects, so `throw "foo"` outputs "Error: foo"
    if (typeof response.exception === "string") {
      errorMessage = new Error(errorMessage).toString();
    }
    const result = response.result;
    const helperResult = response.helperResult;
    const helperHasRawOutput = !!(helperResult || {}).rawOutput;

    if (helperResult && helperResult.type) {
      switch (helperResult.type) {
        case "clearOutput":
          this.hud.clearOutput();
          break;
        case "clearHistory":
          this.props.clearHistory();
          break;
        case "inspectObject":
          this.inspectObjectActor(helperResult.object);
          break;
        case "error":
          try {
            errorMessage = l10n.getStr(helperResult.message);
          } catch (ex) {
            errorMessage = helperResult.message;
          }
          break;
        case "help":
          this.hud.owner.openLink(HELP_URL);
          break;
        case "copyValueToClipboard":
          clipboardHelper.copyString(helperResult.value);
          break;
        case "screenshotOutput":
          const { args, value } = helperResult;
          const results = await processScreenshot(this.hud.window, args, value);
          this.screenshotNotify(results);
          // early return as screenshot notify has dispatched all necessary messages
          return;
      }
    }

    // Hide undefined results coming from JSTerm helper functions.
    if (!errorMessage && result && typeof result == "object" &&
      result.type == "undefined" &&
      helperResult && !helperHasRawOutput) {
      callback && callback();
      return;
    }

    if (this.hud.consoleOutput) {
      this.hud.consoleOutput.dispatchMessageAdd(response, true).then(callback);
    }
  }

  inspectObjectActor(objectActor) {
    this.hud.consoleOutput.dispatchMessageAdd({
      helperResult: {
        type: "inspectObject",
        object: objectActor
      }
    }, true);
    return this.hud.consoleOutput;
  }

  screenshotNotify(results) {
    const wrappedResults = results.map(result => ({ result }));
    this.hud.consoleOutput.dispatchMessagesAdd(wrappedResults);
  }

  /**
   * Execute a string. Execution happens asynchronously in the content process.
   *
   * @param string [executeString]
   *        The string you want to execute. If this is not provided, the current
   *        user input is used - taken from |this.getInputValue()|.
   * @param function [callback]
   *        Optional function to invoke when the result is displayed.
   *        This is deprecated - please use the promise return value instead.
   * @returns Promise
   *          Resolves with the message once the result is displayed.
   */
  async execute(executeString, callback) {
    const deferred = defer();
    const resultCallback = msg => deferred.resolve(msg);

    // attempt to execute the content of the inputNode
    executeString = executeString || this.getInputValue();
    if (!executeString) {
      return null;
    }

    // Append executed expression into the history list.
    this.props.appendToHistory(executeString);

    WebConsoleUtils.usageCount++;
    this.setInputValue("");
    this.clearCompletion();

    let selectedNodeActor = null;
    const inspectorSelection = this.hud.owner.getInspectorSelection();
    if (inspectorSelection && inspectorSelection.nodeFront) {
      selectedNodeActor = inspectorSelection.nodeFront.actorID;
    }

    const { ConsoleCommand } = require("devtools/client/webconsole/types");
    const message = new ConsoleCommand({
      messageText: executeString,
    });
    this.hud.proxy.dispatchMessageAdd(message);

    const onResult = this._executeResultCallback.bind(this, resultCallback);

    const options = {
      frame: this.SELECTED_FRAME,
      selectedNodeActor: selectedNodeActor,
    };

    const mappedString = await this.hud.owner.getMappedExpression(executeString);
    this.requestEvaluation(mappedString, options).then(onResult, onResult);

    return deferred.promise;
  }

  /**
   * Request a JavaScript string evaluation from the server.
   *
   * @param string str
   *        String to execute.
   * @param object [options]
   *        Options for evaluation:
   *        - bindObjectActor: tells the ObjectActor ID for which you want to do
   *        the evaluation. The Debugger.Object of the OA will be bound to
   *        |_self| during evaluation, such that it's usable in the string you
   *        execute.
   *        - frame: tells the stackframe depth to evaluate the string in. If
   *        the jsdebugger is paused, you can pick the stackframe to be used for
   *        evaluation. Use |this.SELECTED_FRAME| to always pick th;
   *        user-selected stackframe.
   *        If you do not provide a |frame| the string will be evaluated in the
   *        global content window.
   *        - selectedNodeActor: tells the NodeActor ID of the current selection
   *        in the Inspector, if such a selection exists. This is used by
   *        helper functions that can evaluate on the current selection.
   * @return object
   *         A promise object that is resolved when the server response is
   *         received.
   */
  requestEvaluation(str, options = {}) {
    const toolbox = gDevTools.getToolbox(this.hud.owner.target);
    const deferred = defer();

    function onResult(response) {
      if (!response.error) {
        deferred.resolve(response);
      } else {
        deferred.reject(response);
      }
    }

    let frameActor = null;
    if ("frame" in options) {
      frameActor = this.getFrameActor(options.frame);
    }

    const evalOptions = {
      bindObjectActor: options.bindObjectActor,
      frameActor: frameActor,
      selectedNodeActor: options.selectedNodeActor,
      selectedObjectActor: options.selectedObjectActor,
    };

    this.webConsoleClient.evaluateJSAsync(str, onResult, evalOptions);

    // Send telemetry event. If we are in the browser toolbox we send -1 as the
    // toolbox session id.
    this._telemetry.recordEvent("devtools.main", "execute_js", "webconsole", null, {
      "lines": str.split(/\n/).length,
      "session_id": toolbox ? toolbox.sessionId : -1
    });

    return deferred.promise;
  }

  /**
   * Copy the object/variable by invoking the server
   * which invokes the `copy(variable)` command and makes it
   * available in the clipboard
   * @param evalString - string which has the evaluation string to be copied
   * @param options - object - Options for evaluation
   * @return object
   *         A promise object that is resolved when the server response is
   *         received.
   */
  copyObject(evalString, evalOptions) {
    return this.webConsoleClient.evaluateJSAsync(`copy(${evalString})`,
      null, evalOptions);
  }

  /**
   * Retrieve the FrameActor ID given a frame depth.
   *
   * @param number frame
   *        Frame depth.
   * @return string|null
   *         The FrameActor ID for the given frame depth.
   */
  getFrameActor(frame) {
    const state = this.hud.owner.getDebuggerFrames();
    if (!state) {
      return null;
    }

    let grip;
    if (frame == this.SELECTED_FRAME) {
      grip = state.frames[state.selected];
    } else {
      grip = state.frames[frame];
    }

    return grip ? grip.actor : null;
  }

  /**
   * Updates the size of the input field (command line) to fit its contents.
   *
   * @returns void
   */
  resizeInput() {
    if (this.props.codeMirrorEnabled) {
      return;
    }

    if (!this.inputNode) {
      return;
    }

    const inputNode = this.inputNode;

    // Reset the height so that scrollHeight will reflect the natural height of
    // the contents of the input field.
    inputNode.style.height = "auto";

    // Now resize the input field to fit its contents.
    const scrollHeight = inputNode.scrollHeight;

    if (scrollHeight > 0) {
      inputNode.style.height = (scrollHeight + this.inputBorderSize) + "px";
    }
  }

  /**
   * Sets the value of the input field (command line), and resizes the field to
   * fit its contents. This method is preferred over setting "inputNode.value"
   * directly, because it correctly resizes the field.
   *
   * @param string newValue
   *        The new value to set.
   * @returns void
   */
  setInputValue(newValue) {
    if (this.props.codeMirrorEnabled) {
      if (this.editor) {
        this.editor.setText(newValue);
      }
    } else {
      if (!this.inputNode) {
        return;
      }

      this.inputNode.value = newValue;
      this.completeNode.value = "";
    }

    this.lastInputValue = newValue;
    this.resizeInput();
    this._inputChanged = true;
    this.emit("set-input-value");
  }

  /**
   * Gets the value from the input field
   * @returns string
   */
  getInputValue() {
    if (this.props.codeMirrorEnabled) {
      return this.editor.getText() || "";
    }

    return this.inputNode ? this.inputNode.value || "" : "";
  }

  /**
   * The inputNode "input" and "keyup" event handler.
   * @private
   */
  _inputEventHandler() {
    if (this.lastInputValue != this.getInputValue()) {
      this.resizeInput();
      this.complete(this.COMPLETE_HINT_ONLY);
      this.lastInputValue = this.getInputValue();
      this._inputChanged = true;
    }
  }

  /**
   * The window "blur" event handler.
   * @private
   */
  _blurEventHandler() {
    if (this.autocompletePopup) {
      this.clearCompletion();
    }
  }

  /* eslint-disable complexity */
  /**
   * The inputNode "keypress" event handler.
   *
   * @private
   * @param Event event
   */
  _keyPress(event) {
    const inputNode = this.inputNode;
    const inputValue = this.getInputValue();
    let inputUpdated = false;

    if (event.ctrlKey) {
      switch (event.charCode) {
        case 101:
          // control-e
          if (Services.appinfo.OS == "WINNT") {
            break;
          }
          let lineEndPos = inputValue.length;
          if (this.hasMultilineInput()) {
            // find index of closest newline >= cursor
            for (let i = inputNode.selectionEnd; i < lineEndPos; i++) {
              if (inputValue.charAt(i) == "\r" ||
                  inputValue.charAt(i) == "\n") {
                lineEndPos = i;
                break;
              }
            }
          }
          inputNode.setSelectionRange(lineEndPos, lineEndPos);
          event.preventDefault();
          this.clearCompletion();
          break;

        case 110:
          // Control-N differs from down arrow: it ignores autocomplete state.
          // Note that we preserve the default 'down' navigation within
          // multiline text.
          if (Services.appinfo.OS == "Darwin" &&
              this.canCaretGoNext() &&
              this.historyPeruse(HISTORY_FORWARD)) {
            event.preventDefault();
            // Ctrl-N is also used to focus the Network category button on
            // MacOSX. The preventDefault() call doesn't prevent the focus
            // from moving away from the input.
            this.focus();
          }
          this.clearCompletion();
          break;

        case 112:
          // Control-P differs from up arrow: it ignores autocomplete state.
          // Note that we preserve the default 'up' navigation within
          // multiline text.
          if (Services.appinfo.OS == "Darwin" &&
              this.canCaretGoPrevious() &&
              this.historyPeruse(HISTORY_BACK)) {
            event.preventDefault();
            // Ctrl-P may also be used to focus some category button on MacOSX.
            // The preventDefault() call doesn't prevent the focus from moving
            // away from the input.
            this.focus();
          }
          this.clearCompletion();
          break;
        default:
          break;
      }
      return;
    } else if (event.keyCode == KeyCodes.DOM_VK_RETURN) {
      if (!this.autocompletePopup.isOpen && (
        event.shiftKey || !Debugger.isCompilableUnit(this.getInputValue())
      )) {
        // shift return or incomplete statement
        return;
      }
    }

    switch (event.keyCode) {
      case KeyCodes.DOM_VK_ESCAPE:
        if (this.autocompletePopup.isOpen) {
          this.clearCompletion();
          event.preventDefault();
          event.stopPropagation();
        }
        break;

      case KeyCodes.DOM_VK_RETURN:
        if (this._autocompletePopupNavigated &&
            this.autocompletePopup.isOpen &&
            this.autocompletePopup.selectedIndex > -1) {
          this.acceptProposedCompletion();
        } else {
          this.execute();
          this._inputChanged = false;
        }
        event.preventDefault();
        break;

      case KeyCodes.DOM_VK_UP:
        if (this.autocompletePopup.isOpen) {
          inputUpdated = this.complete(this.COMPLETE_BACKWARD);
          if (inputUpdated) {
            this._autocompletePopupNavigated = true;
          }
        } else if (this.canCaretGoPrevious()) {
          inputUpdated = this.historyPeruse(HISTORY_BACK);
        }
        if (inputUpdated) {
          event.preventDefault();
        }
        break;

      case KeyCodes.DOM_VK_DOWN:
        if (this.autocompletePopup.isOpen) {
          inputUpdated = this.complete(this.COMPLETE_FORWARD);
          if (inputUpdated) {
            this._autocompletePopupNavigated = true;
          }
        } else if (this.canCaretGoNext()) {
          inputUpdated = this.historyPeruse(HISTORY_FORWARD);
        }
        if (inputUpdated) {
          event.preventDefault();
        }
        break;

      case KeyCodes.DOM_VK_PAGE_UP:
        if (this.autocompletePopup.isOpen) {
          inputUpdated = this.complete(this.COMPLETE_PAGEUP);
          if (inputUpdated) {
            this._autocompletePopupNavigated = true;
          }
        } else {
          this.hud.outputScroller.scrollTop =
            Math.max(0,
              this.hud.outputScroller.scrollTop -
              this.hud.outputScroller.clientHeight
            );
        }
        event.preventDefault();
        break;

      case KeyCodes.DOM_VK_PAGE_DOWN:
        if (this.autocompletePopup.isOpen) {
          inputUpdated = this.complete(this.COMPLETE_PAGEDOWN);
          if (inputUpdated) {
            this._autocompletePopupNavigated = true;
          }
        } else {
          this.hud.outputScroller.scrollTop =
            Math.min(this.hud.outputScroller.scrollHeight,
              this.hud.outputScroller.scrollTop +
              this.hud.outputScroller.clientHeight
            );
        }
        event.preventDefault();
        break;

      case KeyCodes.DOM_VK_HOME:
        if (this.autocompletePopup.isOpen) {
          this.autocompletePopup.selectedIndex = 0;
          event.preventDefault();
        } else if (inputValue.length <= 0) {
          this.hud.outputScroller.scrollTop = 0;
          event.preventDefault();
        }
        break;

      case KeyCodes.DOM_VK_END:
        if (this.autocompletePopup.isOpen) {
          this.autocompletePopup.selectedIndex =
            this.autocompletePopup.itemCount - 1;
          event.preventDefault();
        } else if (inputValue.length <= 0) {
          this.hud.outputScroller.scrollTop =
            this.hud.outputScroller.scrollHeight;
          event.preventDefault();
        }
        break;

      case KeyCodes.DOM_VK_LEFT:
        if (this.autocompletePopup.isOpen || this.lastCompletion.value) {
          this.clearCompletion();
        }
        break;

      case KeyCodes.DOM_VK_RIGHT:
        const cursorAtTheEnd = this.inputNode.selectionStart ==
                             this.inputNode.selectionEnd &&
                             this.inputNode.selectionStart ==
                             inputValue.length;
        const haveSuggestion = this.autocompletePopup.isOpen ||
                             this.lastCompletion.value;
        const useCompletion = cursorAtTheEnd || this._autocompletePopupNavigated;
        if (haveSuggestion && useCompletion &&
            this.complete(this.COMPLETE_HINT_ONLY) &&
            this.lastCompletion.value &&
            this.acceptProposedCompletion()) {
          event.preventDefault();
        }
        if (this.autocompletePopup.isOpen) {
          this.clearCompletion();
        }
        break;

      case KeyCodes.DOM_VK_TAB:
        // Generate a completion and accept the first proposed value.
        if (this.complete(this.COMPLETE_HINT_ONLY) &&
            this.lastCompletion &&
            this.acceptProposedCompletion()) {
          event.preventDefault();
        } else if (this._inputChanged) {
          this.updateCompleteNode(l10n.getStr("Autocomplete.blank"));
          event.preventDefault();
        }
        break;
      default:
        break;
    }
  }
  /* eslint-enable complexity */

  /**
   * The inputNode "focus" event handler.
   * @private
   */
  _focusEventHandler() {
    this._inputChanged = false;
  }

  /**
   * Go up/down the history stack of input values.
   *
   * @param number direction
   *        History navigation direction: HISTORY_BACK or HISTORY_FORWARD.
   *
   * @returns boolean
   *          True if the input value changed, false otherwise.
   */
  historyPeruse(direction) {
    const {
      history,
      updatePlaceHolder,
      getValueFromHistory,
    } = this.props;

    if (!history.entries.length) {
      return false;
    }

    const newInputValue = getValueFromHistory(direction);
    const expression = this.getInputValue();
    updatePlaceHolder(direction, expression);

    if (newInputValue != null) {
      this.setInputValue(newInputValue);
      return true;
    }

    return false;
  }

  /**
   * Test for multiline input.
   *
   * @return boolean
   *         True if CR or LF found in node value; else false.
   */
  hasMultilineInput() {
    return /[\r\n]/.test(this.getInputValue());
  }

  /**
   * Check if the caret is at a location that allows selecting the previous item
   * in history when the user presses the Up arrow key.
   *
   * @return boolean
   *         True if the caret is at a location that allows selecting the
   *         previous item in history when the user presses the Up arrow key,
   *         otherwise false.
   */
  canCaretGoPrevious() {
    const node = this.inputNode;
    if (node.selectionStart != node.selectionEnd) {
      return false;
    }

    const multiline = /[\r\n]/.test(node.value);
    return node.selectionStart == 0 ? true :
           node.selectionStart == node.value.length && !multiline;
  }

  /**
   * Check if the caret is at a location that allows selecting the next item in
   * history when the user presses the Down arrow key.
   *
   * @return boolean
   *         True if the caret is at a location that allows selecting the next
   *         item in history when the user presses the Down arrow key, otherwise
   *         false.
   */
  canCaretGoNext() {
    const node = this.inputNode;
    if (node.selectionStart != node.selectionEnd) {
      return false;
    }

    const multiline = /[\r\n]/.test(node.value);
    return node.selectionStart == node.value.length ? true :
           node.selectionStart == 0 && !multiline;
  }

  /**
   * Completes the current typed text in the inputNode. Completion is performed
   * only if the selection/cursor is at the end of the string. If no completion
   * is found, the current inputNode value and cursor/selection stay.
   *
   * @param int type possible values are
   *    - this.COMPLETE_FORWARD: If there is more than one possible completion
   *          and the input value stayed the same compared to the last time this
   *          function was called, then the next completion of all possible
   *          completions is used. If the value changed, then the first possible
   *          completion is used and the selection is set from the current
   *          cursor position to the end of the completed text.
   *          If there is only one possible completion, then this completion
   *          value is used and the cursor is put at the end of the completion.
   *    - this.COMPLETE_BACKWARD: Same as this.COMPLETE_FORWARD but if the
   *          value stayed the same as the last time the function was called,
   *          then the previous completion of all possible completions is used.
   *    - this.COMPLETE_PAGEUP: Scroll up one page if available or select the
   *          first item.
   *    - this.COMPLETE_PAGEDOWN: Scroll down one page if available or select
   *          the last item.
   *    - this.COMPLETE_HINT_ONLY: If there is more than one possible
   *          completion and the input value stayed the same compared to the
   *          last time this function was called, then the same completion is
   *          used again. If there is only one possible completion, then
   *          the this.getInputValue() is set to this value and the selection
   *          is set from the current cursor position to the end of the
   *          completed text.
   * @param function callback
   *        Optional function invoked when the autocomplete properties are
   *        updated.
   * @returns boolean true if there existed a completion for the current input,
   *          or false otherwise.
   */
  complete(type, callback) {
    const inputNode = this.inputNode;
    const inputValue = this.getInputValue();
    const frameActor = this.getFrameActor(this.SELECTED_FRAME);

    // If the inputNode has no value, then don't try to complete on it.
    if (!inputValue) {
      this.clearCompletion();
      callback && callback(this);
      this.emit("autocomplete-updated");
      return false;
    }

    // Only complete if the selection is empty.
    if (inputNode.selectionStart != inputNode.selectionEnd) {
      this.clearCompletion();
      this.callback && callback(this);
      this.emit("autocomplete-updated");
      return false;
    }

    // Update the completion results.
    if (this.lastCompletion.value != inputValue ||
        frameActor != this._lastFrameActorId) {
      this._updateCompletionResult(type, callback);
      return false;
    }

    const popup = this.autocompletePopup;
    let accepted = false;

    if (type != this.COMPLETE_HINT_ONLY && popup.itemCount == 1) {
      this.acceptProposedCompletion();
      accepted = true;
    } else if (type == this.COMPLETE_BACKWARD) {
      popup.selectPreviousItem();
    } else if (type == this.COMPLETE_FORWARD) {
      popup.selectNextItem();
    } else if (type == this.COMPLETE_PAGEUP) {
      popup.selectPreviousPageItem();
    } else if (type == this.COMPLETE_PAGEDOWN) {
      popup.selectNextPageItem();
    }

    callback && callback(this);
    this.emit("autocomplete-updated");
    return accepted || popup.itemCount > 0;
  }

  /**
   * Update the completion result. This operation is performed asynchronously by
   * fetching updated results from the content process.
   *
   * @private
   * @param int type
   *        Completion type. See this.complete() for details.
   * @param function [callback]
   *        Optional, function to invoke when completion results are received.
   */
  _updateCompletionResult(type, callback) {
    const frameActor = this.getFrameActor(this.SELECTED_FRAME);
    if (this.lastCompletion.value == this.getInputValue() &&
        frameActor == this._lastFrameActorId) {
      return;
    }

    const requestId = gSequenceId();
    const cursor = this.inputNode.selectionStart;
    const input = this.getInputValue().substring(0, cursor);
    const cache = this._autocompleteCache;

    // If the current input starts with the previous input, then we already
    // have a list of suggestions and we just need to filter the cached
    // suggestions. When the current input ends with a non-alphanumeri;
    // character we ask the server again for suggestions.

    // Check if last character is non-alphanumeric
    if (!/[a-zA-Z0-9]$/.test(input) || frameActor != this._lastFrameActorId) {
      this._autocompleteQuery = null;
      this._autocompleteCache = null;
    }

    if (this._autocompleteQuery && input.startsWith(this._autocompleteQuery)) {
      let filterBy = input;
      // Find the last non-alphanumeric other than _ or $ if it exists.
      const lastNonAlpha = input.match(/[^a-zA-Z0-9_$][a-zA-Z0-9_$]*$/);
      // If input contains non-alphanumerics, use the part after the last one
      // to filter the cache
      if (lastNonAlpha) {
        filterBy = input.substring(input.lastIndexOf(lastNonAlpha) + 1);
      }

      const newList = cache.sort().filter(function(l) {
        return l.startsWith(filterBy);
      });

      this.lastCompletion = {
        requestId: null,
        completionType: type,
        value: null,
      };

      const response = { matches: newList, matchProp: filterBy };
      this._receiveAutocompleteProperties(null, callback, response);
      return;
    }

    this._lastFrameActorId = frameActor;

    this.lastCompletion = {
      requestId: requestId,
      completionType: type,
      value: null,
    };

    const autocompleteCallback =
      this._receiveAutocompleteProperties.bind(this, requestId, callback);

    this.webConsoleClient.autocomplete(
      input, cursor, autocompleteCallback, frameActor);
  }

  /**
   * Handler for the autocompletion results. This method takes
   * the completion result received from the server and updates the UI
   * accordingly.
   *
   * @param number requestId
   *        Request ID.
   * @param function [callback=null]
   *        Optional, function to invoke when the completion result is received.
   * @param object message
   *        The JSON message which holds the completion results received from
   *        the content process.
   */
  _receiveAutocompleteProperties(requestId, callback, message) {
    const inputNode = this.inputNode;
    const inputValue = this.getInputValue();
    if (this.lastCompletion.value == inputValue ||
        requestId != this.lastCompletion.requestId) {
      return;
    }
    // Cache whatever came from the server if the last char is
    // alphanumeric or '.'
    const cursor = inputNode.selectionStart;
    const inputUntilCursor = inputValue.substring(0, cursor);

    if (requestId != null && /[a-zA-Z0-9.]$/.test(inputUntilCursor)) {
      this._autocompleteCache = message.matches;
      this._autocompleteQuery = inputUntilCursor;
    }

    const matches = message.matches;
    const lastPart = message.matchProp;
    if (!matches.length) {
      this.clearCompletion();
      callback && callback(this);
      this.emit("autocomplete-updated");
      return;
    }

    const items = matches.reverse().map(function(match) {
      return { preLabel: lastPart, label: match };
    });

    const popup = this.autocompletePopup;
    popup.setItems(items);

    const completionType = this.lastCompletion.completionType;
    this.lastCompletion = {
      value: inputValue,
      matchProp: lastPart,
    };
    if (items.length > 1 && !popup.isOpen) {
      const str = this.getInputValue().substr(0, this.inputNode.selectionStart);
      const offset = str.length - (str.lastIndexOf("\n") + 1) - lastPart.length;
      const x = offset * this._inputCharWidth;
      popup.openPopup(inputNode, x + this._chevronWidth);
      this._autocompletePopupNavigated = false;
    } else if (items.length < 2 && popup.isOpen) {
      popup.hidePopup();
      this._autocompletePopupNavigated = false;
    }
    if (items.length == 1) {
      popup.selectedIndex = 0;
    }

    this.onAutocompleteSelect();

    if (completionType != this.COMPLETE_HINT_ONLY && popup.itemCount == 1) {
      this.acceptProposedCompletion();
    } else if (completionType == this.COMPLETE_BACKWARD) {
      popup.selectPreviousItem();
    } else if (completionType == this.COMPLETE_FORWARD) {
      popup.selectNextItem();
    }

    callback && callback(this);
    this.emit("autocomplete-updated");
  }

  onAutocompleteSelect() {
    // Render the suggestion only if the cursor is at the end of the input.
    if (this.inputNode.selectionStart != this.getInputValue().length) {
      return;
    }

    const currentItem = this.autocompletePopup.selectedItem;
    if (currentItem && this.lastCompletion.value) {
      const suffix =
        currentItem.label.substring(this.lastCompletion.matchProp.length);
      this.updateCompleteNode(suffix);
    } else {
      this.updateCompleteNode("");
    }
  }

  /**
   * Clear the current completion information and close the autocomplete popup,
   * if needed.
   */
  clearCompletion() {
    this.lastCompletion = { value: null };
    this.updateCompleteNode("");
    if (this.autocompletePopup) {
      this.autocompletePopup.clearItems();

      if (this.autocompletePopup.isOpen) {
        // Trigger a blur/focus of the JSTerm input to force screen readers to read the
        // value again.
        this.inputNode.blur();
        this.autocompletePopup.once("popup-closed", () => {
          this.inputNode.focus();
        });
        this.autocompletePopup.hidePopup();
        this._autocompletePopupNavigated = false;
      }
    }
  }

  /**
   * Accept the proposed input completion.
   *
   * @return boolean
   *         True if there was a selected completion item and the input value
   *         was updated, false otherwise.
   */
  acceptProposedCompletion() {
    let updated = false;

    const currentItem = this.autocompletePopup.selectedItem;
    if (currentItem && this.lastCompletion.value) {
      const suffix =
        currentItem.label.substring(this.lastCompletion.matchProp.length);
      const cursor = this.inputNode.selectionStart;
      const value = this.getInputValue();
      this.setInputValue(value.substr(0, cursor) +
        suffix + value.substr(cursor));
      const newCursor = cursor + suffix.length;
      this.inputNode.selectionStart = this.inputNode.selectionEnd = newCursor;
      updated = true;
    }

    this.clearCompletion();

    return updated;
  }

  /**
   * Update the node that displays the currently selected autocomplete proposal.
   *
   * @param string suffix
   *        The proposed suffix for the inputNode value.
   */
  updateCompleteNode(suffix) {
    if (!this.completeNode) {
      return;
    }

    // completion prefix = input, with non-control chars replaced by spaces
    const prefix = suffix ? this.getInputValue().replace(/[\S]/g, " ") : "";
    this.completeNode.value = prefix + suffix;
  }
  /**
   * Calculates the width and height of a single character of the input box.
   * This will be used in opening the popup at the correct offset.
   *
   * @private
   */
  _updateCharSize() {
    if (this.props.codeMirrorEnabled || !this.inputNode) {
      return;
    }

    const doc = this.hud.document;
    const tempLabel = doc.createElement("span");
    const style = tempLabel.style;
    style.position = "fixed";
    style.padding = "0";
    style.margin = "0";
    style.width = "auto";
    style.color = "transparent";
    WebConsoleUtils.copyTextStyles(this.inputNode, tempLabel);
    tempLabel.textContent = "x";
    doc.documentElement.appendChild(tempLabel);
    this._inputCharWidth = tempLabel.offsetWidth;
    tempLabel.remove();
    // Calculate the width of the chevron placed at the beginning of the input
    // box. Remove 4 more pixels to accommodate the padding of the popup.
    this._chevronWidth = +doc.defaultView.getComputedStyle(this.inputNode)
                             .paddingLeft.replace(/[^0-9.]/g, "") - 4;
  }

  destroy() {
    this.clearCompletion();

    this.webConsoleClient.clearNetworkRequests();
    if (this.hud.outputNode) {
      // We do this because it's much faster than letting React handle the ConsoleOutput
      // unmounting.
      this.hud.outputNode.innerHTML = "";
    }

    if (this.autocompletePopup) {
      this.autocompletePopup.destroy();
      this.autocompletePopup = null;
    }

    if (this.inputNode) {
      this.inputNode.removeEventListener("keypress", this._keyPress);
      this.inputNode.removeEventListener("input", this._inputEventHandler);
      this.inputNode.removeEventListener("keyup", this._inputEventHandler);
      this.inputNode.removeEventListener("focus", this._focusEventHandler);
      this.hud.window.removeEventListener("blur", this._blurEventHandler);
    }

    this.hud = null;
  }

  render() {
    if (this.props.hud.isBrowserConsole &&
        !Services.prefs.getBoolPref("devtools.chrome.enabled")) {
      return null;
    }

    if (this.props.codeMirrorEnabled) {
      return dom.div({
        className: "jsterm-input-container devtools-monospace",
        key: "jsterm-container",
        style: {direction: "ltr"},
        "aria-live": "off",
        ref: node => {
          this.node = node;
        },
      });
    }

    const {
      onPaste
    } = this.props;

    return (
      dom.div({
        className: "jsterm-input-container",
        key: "jsterm-container",
        style: {direction: "ltr"},
        "aria-live": "off",
      },
        dom.textarea({
          className: "jsterm-complete-node devtools-monospace",
          key: "complete",
          tabIndex: "-1",
          ref: node => {
            this.completeNode = node;
          },
        }),
        dom.textarea({
          className: "jsterm-input-node devtools-monospace",
          key: "input",
          tabIndex: "0",
          rows: "1",
          "aria-autocomplete": "list",
          ref: node => {
            this.inputNode = node;
          },
          onPaste: onPaste,
          onDrop: onPaste,
        })
      )
    );
  }
}

// Redux connect

function mapStateToProps(state) {
  return {
    history: getHistory(state),
    getValueFromHistory: (direction) => getHistoryValue(state, direction),
  };
}

function mapDispatchToProps(dispatch) {
  return {
    appendToHistory: (expr) => dispatch(historyActions.appendToHistory(expr)),
    clearHistory: () => dispatch(historyActions.clearHistory()),
    updatePlaceHolder: (direction, expression) =>
      dispatch(historyActions.updatePlaceHolder(direction, expression)),
  };
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(JSTerm);
