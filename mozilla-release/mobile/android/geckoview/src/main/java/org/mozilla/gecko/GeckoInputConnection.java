/* -*- Mode: Java; c-basic-offset: 4; tab-width: 20; indent-tabs-mode: nil; -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;

import org.mozilla.gecko.util.ActivityUtils;
import org.mozilla.gecko.util.GamepadUtils;
import org.mozilla.gecko.util.ThreadUtils;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Matrix;
import android.graphics.RectF;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.text.Editable;
import android.text.InputType;
import android.text.Selection;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.method.KeyListener;
import android.text.method.TextKeyListener;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.BaseInputConnection;
import android.view.inputmethod.CursorAnchorInfo;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.ExtractedText;
import android.view.inputmethod.ExtractedTextRequest;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;

/* package */ class GeckoInputConnection
    extends BaseInputConnection
    implements TextInputController.Delegate,
               TextInputController.EditableListener {

    private static final boolean DEBUG = false;
    protected static final String LOGTAG = "GeckoInputConnection";

    private static final String CUSTOM_HANDLER_TEST_METHOD = "testInputConnection";
    private static final String CUSTOM_HANDLER_TEST_CLASS =
        "org.mozilla.gecko.tests.components.GeckoViewComponent$TextInput";

    private static final int INLINE_IME_MIN_DISPLAY_SIZE = 480;

    private static Handler sBackgroundHandler;

    // Managed only by notifyIMEContext; see comments in notifyIMEContext
    private int mIMEState;
    private String mIMETypeHint = "";
    private String mIMEModeHint = "";
    private String mIMEActionHint = "";
    private int mIMEFlags;
    private boolean mFocused;
    private int mLastSelectionStart;
    private int mLastSelectionEnd;

    private String mCurrentInputMethod = "";

    private final GeckoSession mSession;
    private final View mView;
    private final TextInputController.EditableClient mEditableClient;
    protected int mBatchEditCount;
    private ExtractedTextRequest mUpdateRequest;
    private final ExtractedText mUpdateExtract = new ExtractedText();
    private final InputConnection mKeyInputConnection;
    private CursorAnchorInfo.Builder mCursorAnchorInfoBuilder;

    // Prevent showSoftInput and hideSoftInput from causing reentrant calls on some devices.
    private volatile boolean mSoftInputReentrancyGuard;

    public static TextInputController.Delegate create(
            final GeckoSession session,
            final View targetView,
            final TextInputController.EditableClient editable) {
        if (DEBUG) {
            return DebugGeckoInputConnection.create(session, targetView, editable);
        } else {
            return new GeckoInputConnection(session, targetView, editable);
        }
    }

    protected GeckoInputConnection(final GeckoSession session,
                                   final View targetView,
                                   final TextInputController.EditableClient editable) {
        super(targetView, true);
        mSession = session;
        mView = targetView;
        mEditableClient = editable;
        mIMEState = IME_STATE_DISABLED;
        // InputConnection that sends keys for plugins, which don't have full editors
        mKeyInputConnection = new BaseInputConnection(targetView, false);
    }

    @Override
    public synchronized boolean beginBatchEdit() {
        mBatchEditCount++;
        if (mBatchEditCount == 1) {
            mEditableClient.setBatchMode(true);
        }
        return true;
    }

    @Override
    public synchronized boolean endBatchEdit() {
        if (mBatchEditCount <= 0) {
            Log.w(LOGTAG, "endBatchEdit() called, but mBatchEditCount <= 0?!");
            return true;
        }

        mBatchEditCount--;
        if (mBatchEditCount != 0) {
            return true;
        }

        // setBatchMode will call onTextChange and/or onSelectionChange for us.
        mEditableClient.setBatchMode(false);
        return true;
    }

    @Override
    public Editable getEditable() {
        return mEditableClient.getEditable();
    }

    @Override
    public boolean performContextMenuAction(int id) {
        final View view = getView();
        final Editable editable = getEditable();
        if (view == null || editable == null) {
            return false;
        }
        int selStart = Selection.getSelectionStart(editable);
        int selEnd = Selection.getSelectionEnd(editable);

        switch (id) {
            case android.R.id.selectAll:
                setSelection(0, editable.length());
                break;
            case android.R.id.cut:
                // If selection is empty, we'll select everything
                if (selStart == selEnd) {
                    // Fill the clipboard
                    Clipboard.setText(view.getContext(), editable);
                    editable.clear();
                } else {
                    Clipboard.setText(view.getContext(),
                                      editable.subSequence(Math.min(selStart, selEnd),
                                                           Math.max(selStart, selEnd)));
                    editable.delete(selStart, selEnd);
                }
                break;
            case android.R.id.paste:
                commitText(Clipboard.getText(view.getContext()), 1);
                break;
            case android.R.id.copy:
                // Copy the current selection or the empty string if nothing is selected.
                String copiedText = selStart == selEnd ? "" :
                                    editable.toString().substring(
                                        Math.min(selStart, selEnd),
                                        Math.max(selStart, selEnd));
                Clipboard.setText(view.getContext(), copiedText);
                break;
        }
        return true;
    }

    @Override
    public ExtractedText getExtractedText(ExtractedTextRequest req, int flags) {
        if (req == null)
            return null;

        if ((flags & GET_EXTRACTED_TEXT_MONITOR) != 0)
            mUpdateRequest = req;

        Editable editable = getEditable();
        if (editable == null) {
            return null;
        }
        int selStart = Selection.getSelectionStart(editable);
        int selEnd = Selection.getSelectionEnd(editable);

        ExtractedText extract = new ExtractedText();
        extract.flags = 0;
        extract.partialStartOffset = -1;
        extract.partialEndOffset = -1;
        extract.selectionStart = selStart;
        extract.selectionEnd = selEnd;
        extract.startOffset = 0;
        if ((req.flags & GET_TEXT_WITH_STYLES) != 0) {
            extract.text = new SpannableString(editable);
        } else {
            extract.text = editable.toString();
        }
        return extract;
    }

    @Override // TextInputController.Delegate
    public View getView() {
        return mView;
    }

    private InputMethodManager getInputMethodManager() {
        View view = getView();
        if (view == null) {
            return null;
        }
        Context context = view.getContext();
        return InputMethods.getInputMethodManager(context);
    }

    private void showSoftInputWithToolbar(final boolean showToolbar) {
        if (mSoftInputReentrancyGuard) {
            return;
        }
        final View v = getView();
        final InputMethodManager imm = getInputMethodManager();
        if (v == null || imm == null) {
            return;
        }

        v.post(new Runnable() {
            @Override
            public void run() {
                if (v.hasFocus() && !imm.isActive(v)) {
                    // Marshmallow workaround: The view has focus but it is not the active
                    // view for the input method. (Bug 1211848)
                    v.clearFocus();
                    v.requestFocus();
                }

                if (showToolbar) {
                    mSession.getDynamicToolbarAnimator().showToolbar(/* immediately */ true);
                }
                mSession.getEventDispatcher().dispatch("GeckoView:ZoomToInput", null);

                mSoftInputReentrancyGuard = true;
                imm.showSoftInput(v, 0);
                mSoftInputReentrancyGuard = false;
            }
        });
    }

    private void hideSoftInput() {
        if (mSoftInputReentrancyGuard) {
            return;
        }
        final InputMethodManager imm = getInputMethodManager();
        if (imm != null) {
            final View v = getView();
            mSoftInputReentrancyGuard = true;
            imm.hideSoftInputFromWindow(v.getWindowToken(), 0);
            mSoftInputReentrancyGuard = false;
        }
    }

    private void restartInput() {

        final InputMethodManager imm = getInputMethodManager();
        if (imm == null) {
            return;
        }
        final View v = getView();
        // InputMethodManager has internal logic to detect if we are restarting input
        // in an already focused View, which is the case here because all content text
        // fields are inside one LayerView. When this happens, InputMethodManager will
        // tell the input method to soft reset instead of hard reset. Stock latin IME
        // on Android 4.2+ has a quirk that when it soft resets, it does not clear the
        // composition. The following workaround tricks the IME into clearing the
        // composition when soft resetting.
        if (InputMethods.needsSoftResetWorkaround(mCurrentInputMethod)) {
            // Fake a selection change, because the IME clears the composition when
            // the selection changes, even if soft-resetting. Offsets here must be
            // different from the previous selection offsets, and -1 seems to be a
            // reasonable, deterministic value
            notifySelectionChange(-1, -1);
        }
        try {
            imm.restartInput(v);
        } catch (RuntimeException e) {
            Log.e(LOGTAG, "Error restarting input", e);
        }
    }

    private void resetInputConnection() {
        if (mBatchEditCount != 0) {
            Log.w(LOGTAG, "resetting with mBatchEditCount = " + mBatchEditCount);
            mBatchEditCount = 0;
        }

        // Do not reset mIMEState here; see comments in notifyIMEContext

        restartInput();
    }

    @Override // TextInputController.EditableListener
    public void onTextChange() {

        if (mUpdateRequest == null) {
            return;
        }

        final InputMethodManager imm = getInputMethodManager();
        final View v = getView();
        final Editable editable = getEditable();
        if (imm == null || v == null || editable == null) {
            return;
        }
        mUpdateExtract.flags = 0;
        // Update the entire Editable range
        mUpdateExtract.partialStartOffset = -1;
        mUpdateExtract.partialEndOffset = -1;
        mUpdateExtract.selectionStart = Selection.getSelectionStart(editable);
        mUpdateExtract.selectionEnd = Selection.getSelectionEnd(editable);
        mUpdateExtract.startOffset = 0;
        if ((mUpdateRequest.flags & GET_TEXT_WITH_STYLES) != 0) {
            mUpdateExtract.text = new SpannableString(editable);
        } else {
            mUpdateExtract.text = editable.toString();
        }
        imm.updateExtractedText(v, mUpdateRequest.token, mUpdateExtract);
    }

    @Override // TextInputController.EditableListener
    public void onSelectionChange() {

        final Editable editable = getEditable();
        if (editable != null) {
            mLastSelectionStart = Selection.getSelectionStart(editable);
            mLastSelectionEnd = Selection.getSelectionEnd(editable);
            notifySelectionChange(mLastSelectionStart, mLastSelectionEnd);
        }
    }

    private void notifySelectionChange(int start, int end) {

        final InputMethodManager imm = getInputMethodManager();
        final View v = getView();
        final Editable editable = getEditable();
        if (imm == null || v == null || editable == null) {
            return;
        }
        imm.updateSelection(v, start, end, getComposingSpanStart(editable),
                            getComposingSpanEnd(editable));
    }

    @TargetApi(21)
    @Override // TextInputController.EditableListener
    public void updateCompositionRects(final RectF[] rects) {
        if (!(Build.VERSION.SDK_INT >= 21)) {
            return;
        }

        final View view = getView();
        if (view == null) {
            return;
        }

        final Editable content = getEditable();
        if (content == null) {
            return;
        }

        final int composingStart = getComposingSpanStart(content);
        final int composingEnd = getComposingSpanEnd(content);
        if (composingStart < 0 || composingEnd < 0) {
            if (DEBUG) {
                Log.d(LOGTAG, "No composition for updates");
            }
            return;
        }

        final CharSequence composition = content.subSequence(composingStart, composingEnd);

        view.post(new Runnable() {
            @Override
            public void run() {
                updateCompositionRectsOnUi(view, rects, composition);
            }
        });
    }

    @TargetApi(21)
    /* package */ void updateCompositionRectsOnUi(final View view,
                                                  final RectF[] rects,
                                                  final CharSequence composition) {
        if (mCursorAnchorInfoBuilder == null) {
            mCursorAnchorInfoBuilder = new CursorAnchorInfo.Builder();
        }
        mCursorAnchorInfoBuilder.reset();

        final Matrix matrix = new Matrix();
        mSession.getClientToScreenMatrix(matrix);
        mCursorAnchorInfoBuilder.setMatrix(matrix);

        for (int i = 0; i < rects.length; i++) {
            mCursorAnchorInfoBuilder.addCharacterBounds(
                    i, rects[i].left, rects[i].top, rects[i].right, rects[i].bottom,
                    CursorAnchorInfo.FLAG_HAS_VISIBLE_REGION);
        }

        mCursorAnchorInfoBuilder.setComposingText(0, composition);

        final InputMethodManager imm = getInputMethodManager();
        if (imm == null) {
            return;
        }

        imm.updateCursorAnchorInfo(view, mCursorAnchorInfoBuilder.build());
    }

    @Override
    public boolean requestCursorUpdates(int cursorUpdateMode) {

        if ((cursorUpdateMode & InputConnection.CURSOR_UPDATE_IMMEDIATE) != 0) {
            mEditableClient.requestCursorUpdates(
                    TextInputController.EditableClient.ONE_SHOT);
        }

        if ((cursorUpdateMode & InputConnection.CURSOR_UPDATE_MONITOR) != 0) {
            mEditableClient.requestCursorUpdates(
                    TextInputController.EditableClient.START_MONITOR);
        } else {
            mEditableClient.requestCursorUpdates(
                    TextInputController.EditableClient.END_MONITOR);
        }
        return true;
    }

    @Override // TextInputController.EditableListener
    public void onDefaultKeyEvent(final KeyEvent event) {
        ThreadUtils.postToUiThread(new Runnable() {
            @Override
            public void run() {
                GeckoInputConnection.this.performDefaultKeyAction(event);
            }
        });
    }

    private static synchronized Handler getBackgroundHandler() {
        if (sBackgroundHandler != null) {
            return sBackgroundHandler;
        }
        // Don't use GeckoBackgroundThread because Gecko thread may block waiting on
        // GeckoBackgroundThread. If we were to use GeckoBackgroundThread, due to IME,
        // GeckoBackgroundThread may end up also block waiting on Gecko thread and a
        // deadlock occurs
        Thread backgroundThread = new Thread(new Runnable() {
            @Override
            public void run() {
                Looper.prepare();
                synchronized (GeckoInputConnection.class) {
                    sBackgroundHandler = new Handler();
                    GeckoInputConnection.class.notify();
                }
                Looper.loop();
                // We should never be exiting the thread loop.
                throw new IllegalThreadStateException("unreachable code");
            }
        }, LOGTAG);
        backgroundThread.setDaemon(true);
        backgroundThread.start();
        while (sBackgroundHandler == null) {
            try {
                // wait for new thread to set sBackgroundHandler
                GeckoInputConnection.class.wait();
            } catch (InterruptedException e) {
            }
        }
        return sBackgroundHandler;
    }

    private synchronized boolean canReturnCustomHandler() {
        if (mIMEState == IME_STATE_DISABLED) {
            return false;
        }
        for (StackTraceElement frame : Thread.currentThread().getStackTrace()) {
            // We only return our custom Handler to InputMethodManager's InputConnection
            // proxy. For all other purposes, we return the regular Handler.
            // InputMethodManager retrieves the Handler for its InputConnection proxy
            // inside its method startInputInner(), so we check for that here. This is
            // valid from Android 2.2 to at least Android 4.2. If this situation ever
            // changes, we gracefully fall back to using the regular Handler.
            if ("startInputInner".equals(frame.getMethodName()) &&
                "android.view.inputmethod.InputMethodManager".equals(frame.getClassName())) {
                // Only return our own Handler to InputMethodManager and only prior to 24.
                return Build.VERSION.SDK_INT < 24;
            }
            if (CUSTOM_HANDLER_TEST_METHOD.equals(frame.getMethodName()) &&
                CUSTOM_HANDLER_TEST_CLASS.equals(frame.getClassName())) {
                // InputConnection tests should also run on the custom handler
                return true;
            }
        }
        return false;
    }

    private boolean isPhysicalKeyboardPresent() {
        final View v = getView();
        if (v == null) {
            return false;
        }
        final Configuration config = v.getContext().getResources().getConfiguration();
        return config.keyboard != Configuration.KEYBOARD_NOKEYS;
    }

    // Android N: @Override // InputConnection
    // We need to suppress lint complaining about the lack override here in the meantime: it wants us to build
    // against sdk 24, even though we're using 23, and therefore complains about the lack of override.
    // Once we update to 24, we can use the actual override annotation and remove the lint suppression.
    @SuppressLint("Override")
    public Handler getHandler() {
        final Handler handler;
        if (isPhysicalKeyboardPresent()) {
            handler = ThreadUtils.getUiHandler();
        } else {
            handler = getBackgroundHandler();
        }
        return mEditableClient.setInputConnectionHandler(handler);
    }

    @Override // TextInputController.Delegate
    public Handler getHandler(Handler defHandler) {
        if (!canReturnCustomHandler()) {
            return defHandler;
        }

        return getHandler();
    }

    // Android N: @Override // InputConnection
    @SuppressLint("Override")
    public void closeConnection() {
        // Not supported at the moment.
    }

    @Override // TextInputController.Delegate
    public synchronized InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        // Some keyboards require us to fill out outAttrs even if we return null.
        outAttrs.inputType = InputType.TYPE_CLASS_TEXT;
        outAttrs.imeOptions = EditorInfo.IME_ACTION_NONE;
        outAttrs.actionLabel = null;

        if (mIMEState == IME_STATE_DISABLED) {
            hideSoftInput();
            return null;
        }

        if (mIMEState == IME_STATE_PASSWORD ||
            "password".equalsIgnoreCase(mIMETypeHint))
            outAttrs.inputType |= InputType.TYPE_TEXT_VARIATION_PASSWORD;
        else if (mIMETypeHint.equalsIgnoreCase("url") ||
                 mIMETypeHint.equalsIgnoreCase("mozAwesomebar"))
            outAttrs.inputType |= InputType.TYPE_TEXT_VARIATION_URI;
        else if (mIMETypeHint.equalsIgnoreCase("email"))
            outAttrs.inputType |= InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS;
        else if (mIMETypeHint.equalsIgnoreCase("tel"))
            outAttrs.inputType = InputType.TYPE_CLASS_PHONE;
        else if (mIMETypeHint.equalsIgnoreCase("number") ||
                 mIMETypeHint.equalsIgnoreCase("range"))
            outAttrs.inputType = InputType.TYPE_CLASS_NUMBER
                                 | InputType.TYPE_NUMBER_FLAG_SIGNED
                                 | InputType.TYPE_NUMBER_FLAG_DECIMAL;
        else if (mIMETypeHint.equalsIgnoreCase("week") ||
                 mIMETypeHint.equalsIgnoreCase("month"))
            outAttrs.inputType = InputType.TYPE_CLASS_DATETIME
                                  | InputType.TYPE_DATETIME_VARIATION_DATE;
        else if (mIMEModeHint.equalsIgnoreCase("numeric"))
            outAttrs.inputType = InputType.TYPE_CLASS_NUMBER |
                                 InputType.TYPE_NUMBER_FLAG_SIGNED |
                                 InputType.TYPE_NUMBER_FLAG_DECIMAL;
        else if (mIMEModeHint.equalsIgnoreCase("digit"))
            outAttrs.inputType = InputType.TYPE_CLASS_NUMBER;
        else {
            // TYPE_TEXT_FLAG_IME_MULTI_LINE flag makes the fullscreen IME line wrap
            outAttrs.inputType |= InputType.TYPE_TEXT_FLAG_AUTO_CORRECT |
                                  InputType.TYPE_TEXT_FLAG_IME_MULTI_LINE;
            if (mIMETypeHint.equalsIgnoreCase("textarea") ||
                    mIMETypeHint.length() == 0) {
                // empty mIMETypeHint indicates contentEditable/designMode documents
                outAttrs.inputType |= InputType.TYPE_TEXT_FLAG_MULTI_LINE;
            }
            if (mIMEModeHint.equalsIgnoreCase("uppercase"))
                outAttrs.inputType |= InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS;
            else if (mIMEModeHint.equalsIgnoreCase("titlecase"))
                outAttrs.inputType |= InputType.TYPE_TEXT_FLAG_CAP_WORDS;
            else if (mIMETypeHint.equalsIgnoreCase("text") &&
                    !mIMEModeHint.equalsIgnoreCase("autocapitalized"))
                outAttrs.inputType |= InputType.TYPE_TEXT_VARIATION_NORMAL;
            else if (!mIMEModeHint.equalsIgnoreCase("lowercase"))
                outAttrs.inputType |= InputType.TYPE_TEXT_FLAG_CAP_SENTENCES;
            // auto-capitalized mode is the default for types other than text
        }

        if (mIMEActionHint.equalsIgnoreCase("go"))
            outAttrs.imeOptions = EditorInfo.IME_ACTION_GO;
        else if (mIMEActionHint.equalsIgnoreCase("done"))
            outAttrs.imeOptions = EditorInfo.IME_ACTION_DONE;
        else if (mIMEActionHint.equalsIgnoreCase("next"))
            outAttrs.imeOptions = EditorInfo.IME_ACTION_NEXT;
        else if (mIMEActionHint.equalsIgnoreCase("search") ||
                 mIMETypeHint.equalsIgnoreCase("search"))
            outAttrs.imeOptions = EditorInfo.IME_ACTION_SEARCH;
        else if (mIMEActionHint.equalsIgnoreCase("send"))
            outAttrs.imeOptions = EditorInfo.IME_ACTION_SEND;
        else if (mIMEActionHint.length() > 0) {
            if (DEBUG)
                Log.w(LOGTAG, "Unexpected mIMEActionHint=\"" + mIMEActionHint + "\"");
            outAttrs.actionLabel = mIMEActionHint;
        }

        if ((mIMEFlags & IME_FLAG_PRIVATE_BROWSING) != 0) {
            outAttrs.imeOptions |= InputMethods.IME_FLAG_NO_PERSONALIZED_LEARNING;
        }

        Context context = getView().getContext();
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        if (Math.min(metrics.widthPixels, metrics.heightPixels) > INLINE_IME_MIN_DISPLAY_SIZE) {
            // prevent showing full-screen keyboard only when the screen is tall enough
            // to show some reasonable amount of the page (see bug 752709)
            outAttrs.imeOptions |= EditorInfo.IME_FLAG_NO_EXTRACT_UI
                                   | EditorInfo.IME_FLAG_NO_FULLSCREEN;
        }

        if (DEBUG) {
            Log.d(LOGTAG, "mapped IME states to: inputType = " +
                          Integer.toHexString(outAttrs.inputType) + ", imeOptions = " +
                          Integer.toHexString(outAttrs.imeOptions));
        }

        String prevInputMethod = mCurrentInputMethod;
        mCurrentInputMethod = InputMethods.getCurrentInputMethod(context);
        if (DEBUG) {
            Log.d(LOGTAG, "IME: CurrentInputMethod=" + mCurrentInputMethod);
        }

        outAttrs.initialSelStart = mLastSelectionStart;
        outAttrs.initialSelEnd = mLastSelectionEnd;

        if ((mIMEFlags & IME_FLAG_USER_ACTION) != 0) {
            if ((context instanceof Activity) &&
                    ActivityUtils.isFullScreen((Activity) context)) {
                showSoftInputWithToolbar(false);
            } else {
                showSoftInputWithToolbar(true);
            }
        }
        return this;
    }

    private boolean replaceComposingSpanWithSelection() {
        final Editable content = getEditable();
        if (content == null) {
            return false;
        }
        int a = getComposingSpanStart(content),
            b = getComposingSpanEnd(content);
        if (a != -1 && b != -1) {
            if (DEBUG) {
                Log.d(LOGTAG, "removing composition at " + a + "-" + b);
            }
            removeComposingSpans(content);
            Selection.setSelection(content, a, b);
        }
        return true;
    }

    @Override
    public boolean commitText(CharSequence text, int newCursorPosition) {
        if (InputMethods.shouldCommitCharAsKey(mCurrentInputMethod) &&
            text.length() == 1 && newCursorPosition > 0) {
            if (DEBUG) {
                Log.d(LOGTAG, "committing \"" + text + "\" as key");
            }
            // mKeyInputConnection is a BaseInputConnection that commits text as keys;
            // but we first need to replace any composing span with a selection,
            // so that the new key events will generate characters to replace
            // text from the old composing span
            return replaceComposingSpanWithSelection() &&
                mKeyInputConnection.commitText(text, newCursorPosition);
        }
        return super.commitText(text, newCursorPosition);
    }

    @Override
    public boolean setSelection(int start, int end) {
        if (start < 0 || end < 0) {
            // Some keyboards (e.g. Samsung) can call setSelection with
            // negative offsets. In that case we ignore the call, similar to how
            // BaseInputConnection.setSelection ignores offsets that go past the length.
            return true;
        }
        return super.setSelection(start, end);
    }

    /* package */ void sendKeyEvent(final int action, KeyEvent event) {
        final Editable editable = getEditable();
        if (editable == null) {
            return;
        }

        final KeyListener keyListener = TextKeyListener.getInstance();
        event = translateKey(event.getKeyCode(), event);

        // We only let TextKeyListener do UI things on the UI thread.
        final View v = ThreadUtils.isOnUiThread() ? getView() : null;
        final int keyCode = event.getKeyCode();
        final boolean handled;

        if (shouldSkipKeyListener(keyCode, event)) {
            handled = false;
        } else if (action == KeyEvent.ACTION_DOWN) {
            mEditableClient.setSuppressKeyUp(true);
            handled = keyListener.onKeyDown(v, editable, keyCode, event);
        } else if (action == KeyEvent.ACTION_UP) {
            handled = keyListener.onKeyUp(v, editable, keyCode, event);
        } else {
            handled = keyListener.onKeyOther(v, editable, event);
        }

        if (!handled) {
            mEditableClient.sendKeyEvent(event, action, TextKeyListener.getMetaState(editable));
        }

        if (action == KeyEvent.ACTION_DOWN) {
            if (!handled) {
                // Usually, the down key listener call above adjusts meta states for us.
                // However, if the call didn't handle the event, we have to manually
                // adjust meta states so the meta states remain consistent.
                TextKeyListener.adjustMetaAfterKeypress(editable);
            }
            mEditableClient.setSuppressKeyUp(false);
        }
    }

    @Override
    public boolean sendKeyEvent(KeyEvent event) {
        sendKeyEvent(event.getAction(), event);
        return false; // seems to always return false
    }

    @Override // TextInputController.Delegate
    public boolean onKeyPreIme(int keyCode, KeyEvent event) {
        return false;
    }

    private boolean shouldProcessKey(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_MENU:
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_VOLUME_UP:
            case KeyEvent.KEYCODE_VOLUME_DOWN:
            case KeyEvent.KEYCODE_SEARCH:
            // ignore HEADSETHOOK to allow hold-for-voice-search to work
            case KeyEvent.KEYCODE_HEADSETHOOK:
                return false;
        }
        return true;
    }

    private boolean shouldSkipKeyListener(int keyCode, KeyEvent event) {
        if (mIMEState == IME_STATE_DISABLED) {
            return true;
        }
        // Preserve enter and tab keys for the browser
        if (keyCode == KeyEvent.KEYCODE_ENTER ||
            keyCode == KeyEvent.KEYCODE_TAB) {
            return true;
        }
        // BaseKeyListener returns false even if it handled these keys for us,
        // so we skip the key listener entirely and handle these ourselves
        if (keyCode == KeyEvent.KEYCODE_DEL ||
            keyCode == KeyEvent.KEYCODE_FORWARD_DEL) {
            return true;
        }
        return false;
    }

    private KeyEvent translateKey(int keyCode, KeyEvent event) {
        switch (keyCode) {
            case KeyEvent.KEYCODE_ENTER:
                if ((event.getFlags() & KeyEvent.FLAG_EDITOR_ACTION) != 0 &&
                    mIMEActionHint.equalsIgnoreCase("next")) {
                    return new KeyEvent(event.getAction(), KeyEvent.KEYCODE_TAB);
                }
                break;
        }

        if (GamepadUtils.isSonyXperiaGamepadKeyEvent(event)) {
            return GamepadUtils.translateSonyXperiaGamepadKeys(keyCode, event);
        }

        return event;
    }

    // Called by OnDefaultKeyEvent handler, up from Gecko
    /* package */ void performDefaultKeyAction(KeyEvent event) {
        switch (event.getKeyCode()) {
            case KeyEvent.KEYCODE_MUTE:
            case KeyEvent.KEYCODE_HEADSETHOOK:
            case KeyEvent.KEYCODE_MEDIA_PLAY:
            case KeyEvent.KEYCODE_MEDIA_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_MEDIA_STOP:
            case KeyEvent.KEYCODE_MEDIA_NEXT:
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS:
            case KeyEvent.KEYCODE_MEDIA_REWIND:
            case KeyEvent.KEYCODE_MEDIA_RECORD:
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:
            case KeyEvent.KEYCODE_MEDIA_CLOSE:
            case KeyEvent.KEYCODE_MEDIA_EJECT:
            case KeyEvent.KEYCODE_MEDIA_AUDIO_TRACK:
                // Forward media keypresses to the registered handler so headset controls work
                // Does the same thing as Chromium
                // https://chromium.googlesource.com/chromium/src/+/49.0.2623.67/chrome/android/java/src/org/chromium/chrome/browser/tab/TabWebContentsDelegateAndroid.java#445
                // These are all the keys dispatchMediaKeyEvent supports.
                if (Build.VERSION.SDK_INT >= 19) {
                    // dispatchMediaKeyEvent is only available on Android 4.4+
                    Context viewContext = getView().getContext();
                    AudioManager am = (AudioManager)viewContext.getSystemService(Context.AUDIO_SERVICE);
                    am.dispatchMediaKeyEvent(event);
                }
                break;
        }
    }

    private boolean processKey(final int action, final int keyCode, final KeyEvent event) {

        if (keyCode > KeyEvent.getMaxKeyCode() || !shouldProcessKey(keyCode, event)) {
            return false;
        }

        mEditableClient.postToInputConnection(new Runnable() {
            @Override
            public void run() {
                sendKeyEvent(action, event);
            }
        });
        return true;
    }

    @Override // TextInputController.Delegate
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        return processKey(KeyEvent.ACTION_DOWN, keyCode, event);
    }

    @Override // TextInputController.Delegate
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        return processKey(KeyEvent.ACTION_UP, keyCode, event);
    }

    /**
     * Get a key that represents a given character.
     */
    private KeyEvent getCharKeyEvent(final char c) {
        final long time = SystemClock.uptimeMillis();
        return new KeyEvent(time, time, KeyEvent.ACTION_MULTIPLE,
                            KeyEvent.KEYCODE_UNKNOWN, /* repeat */ 0) {
            @Override
            public int getUnicodeChar() {
                return c;
            }

            @Override
            public int getUnicodeChar(int metaState) {
                return c;
            }
        };
    }

    @Override // TextInputController.Delegate
    public boolean onKeyMultiple(int keyCode, int repeatCount, final KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_UNKNOWN) {
            // KEYCODE_UNKNOWN means the characters are in KeyEvent.getCharacters()
            final String str = event.getCharacters();
            for (int i = 0; i < str.length(); i++) {
                final KeyEvent charEvent = getCharKeyEvent(str.charAt(i));
                if (!processKey(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_UNKNOWN, charEvent) ||
                    !processKey(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_UNKNOWN, charEvent)) {
                    return false;
                }
            }
            return true;
        }

        while ((repeatCount--) != 0) {
            if (!processKey(KeyEvent.ACTION_DOWN, keyCode, event) ||
                !processKey(KeyEvent.ACTION_UP, keyCode, event)) {
                return false;
            }
        }
        return true;
    }

    @Override // TextInputController.Delegate
    public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        View v = getView();
        switch (keyCode) {
            case KeyEvent.KEYCODE_MENU:
                InputMethodManager imm = getInputMethodManager();
                imm.toggleSoftInputFromWindow(v.getWindowToken(),
                                              InputMethodManager.SHOW_FORCED, 0);
                return true;
            default:
                break;
        }
        return false;
    }

    @Override // TextInputController.Delegate
    public synchronized boolean isInputActive() {
        // Make sure this picks up PASSWORD state as well.
        return mIMEState != IME_STATE_DISABLED;
    }

    @Override // TextInputController.EditableListener
    public void notifyIME(int type) {
        switch (type) {

            case NOTIFY_IME_OF_FOCUS:
                // Showing/hiding vkb is done in notifyIMEContext
                mFocused = true;
                resetInputConnection();
                break;

            case NOTIFY_IME_OF_BLUR:
                // Showing/hiding vkb is done in notifyIMEContext
                mFocused = false;
                break;

            case NOTIFY_IME_OPEN_VKB:
                showSoftInputWithToolbar(false);
                break;

            case NOTIFY_IME_TO_COMMIT_COMPOSITION: {
                // Gecko already committed its composition. However, Android keyboards
                // have trouble dealing with us removing the composition manually on the
                // Java side. Therefore, we keep the composition intact on the Java side.
                // The text content should still be in-sync on both sides.
                //
                // Nevertheless, if we somehow lost the composition, we must force the
                // keyboard to reset.
                final Editable editable = getEditable();
                if (editable == null) {
                    break;
                }
                final Object[] spans = editable.getSpans(0, editable.length(), Object.class);
                for (final Object span : spans) {
                    if ((editable.getSpanFlags(span) & Spanned.SPAN_COMPOSING) != 0) {
                        // Still have composition; no need to reset.
                        return;
                    }
                }
                // No longer have composition; perform reset.
                restartInput();
                break;
            }

            default:
                if (DEBUG) {
                    throw new IllegalArgumentException("Unexpected NOTIFY_IME=" + type);
                }
                break;
        }
    }

    @Override // TextInputController.EditableListener
    public synchronized void notifyIMEContext(int state, final String typeHint,
                                              final String modeHint, final String actionHint,
                                              final int flags) {
        // For some input type we will use a widget to display the ui, for those we must not
        // display the ime. We can display a widget for date and time types and, if the sdk version
        // is 11 or greater, for datetime/month/week as well.
        if (typeHint != null &&
            (typeHint.equalsIgnoreCase("date") ||
             typeHint.equalsIgnoreCase("time") ||
             typeHint.equalsIgnoreCase("datetime") ||
             typeHint.equalsIgnoreCase("month") ||
             typeHint.equalsIgnoreCase("week") ||
             typeHint.equalsIgnoreCase("datetime-local"))) {
            state = IME_STATE_DISABLED;
        }

        // mIMEState and the mIME*Hint fields should only be changed by notifyIMEContext,
        // and not reset anywhere else. Usually, notifyIMEContext is called right after a
        // focus or blur, so resetting mIMEState during the focus or blur seems harmless.
        // However, this behavior is not guaranteed. Gecko may call notifyIMEContext
        // independent of focus change; that is, a focus change may not be accompanied by
        // a notifyIMEContext call. So if we reset mIMEState inside focus, there may not
        // be another notifyIMEContext call to set mIMEState to a proper value (bug 829318)
        /* When IME is 'disabled', IME processing is disabled.
           In addition, the IME UI is hidden */
        mIMEState = state;
        mIMETypeHint = (typeHint == null) ? "" : typeHint;
        mIMEModeHint = (modeHint == null) ? "" : modeHint;
        mIMEActionHint = (actionHint == null) ? "" : actionHint;
        mIMEFlags = flags;

        // These fields are reset here and will be updated when restartInput is called below
        mUpdateRequest = null;
        mCurrentInputMethod = "";

        View v = getView();
        if (v == null || !v.hasFocus()) {
            // When using Find In Page, we can still receive notifyIMEContext calls due to the
            // selection changing when highlighting. However in this case we don't want to reset/
            // show/hide the keyboard because the find box has the focus and is taking input from
            // the keyboard.
            return;
        }

        // On focus, the notifyIMEContext call comes *before* the
        // notifyIME(NOTIFY_IME_OF_FOCUS) call, but we need to call restartInput during
        // notifyIME, so we skip restartInput here. On blur, the notifyIMEContext call
        // comes *after* the notifyIME(NOTIFY_IME_OF_BLUR) call, and we need to call
        // restartInput here.
        if (mIMEState == IME_STATE_DISABLED || mFocused) {
            restartInput();
        }
    }
}

final class DebugGeckoInputConnection
        extends GeckoInputConnection
        implements InvocationHandler {

    private InputConnection mProxy;
    private final StringBuilder mCallLevel;

    private DebugGeckoInputConnection(final GeckoSession session,
                                      final View targetView,
                                      final TextInputController.EditableClient editable) {
        super(session, targetView, editable);
        mCallLevel = new StringBuilder();
    }

    public static TextInputController.Delegate create(
            final GeckoSession session,
            final View targetView,
            final TextInputController.EditableClient editable) {
        final Class<?>[] PROXY_INTERFACES = { InputConnection.class,
                TextInputController.Delegate.class,
                TextInputController.EditableListener.class };
        DebugGeckoInputConnection dgic =
                new DebugGeckoInputConnection(session, targetView, editable);
        dgic.mProxy = (InputConnection) Proxy.newProxyInstance(
                GeckoInputConnection.class.getClassLoader(),
                PROXY_INTERFACES, dgic);
        return (TextInputController.Delegate) dgic.mProxy;
    }

    @Override
    public Object invoke(Object proxy, Method method, Object[] args)
            throws Throwable {

        StringBuilder log = new StringBuilder(mCallLevel);
        log.append("> ").append(method.getName()).append("(");
        if (args != null) {
            for (Object arg : args) {
                // translate argument values to constant names
                if ("notifyIME".equals(method.getName()) && arg == args[0]) {
                    log.append(GeckoEditable.getConstantName(
                        TextInputController.EditableListener.class, "NOTIFY_IME_", arg));
                } else if ("notifyIMEContext".equals(method.getName()) && arg == args[0]) {
                    log.append(GeckoEditable.getConstantName(
                        TextInputController.EditableListener.class, "IME_STATE_", arg));
                } else {
                    GeckoEditable.debugAppend(log, arg);
                }
                log.append(", ");
            }
            if (args.length > 0) {
                log.setLength(log.length() - 2);
            }
        }
        log.append(")");
        Log.d(LOGTAG, log.toString());

        mCallLevel.append(' ');
        Object ret = method.invoke(this, args);
        if (ret == this) {
            ret = mProxy;
        }
        mCallLevel.setLength(Math.max(0, mCallLevel.length() - 1));

        log.setLength(mCallLevel.length());
        log.append("< ").append(method.getName());
        if (!method.getReturnType().equals(Void.TYPE)) {
            GeckoEditable.debugAppend(log.append(": "), ret);
        }
        Log.d(LOGTAG, log.toString());
        return ret;
    }
}
