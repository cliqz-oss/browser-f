var loop = loop || {};
loop.feedbackViews = (function(_, mozL10n) {
  "use strict";

  /**
   * Feedback view is displayed once every 6 months (loop.feedback.periodSec)
   * after a conversation has ended.
   */
  var FeedbackView = React.createClass({displayName: "FeedbackView",
    propTypes: {
      mozLoop: React.PropTypes.object.isRequired,
      onAfterFeedbackReceived: React.PropTypes.func.isRequired
    },

    /**
     * Pressing the button to leave feedback will open the form in a new page
     * and close the conversation window.
     */
    onFeedbackButtonClick: function() {
      var url = this.props.mozLoop.getLoopPref("feedback.formURL");
      this.props.mozLoop.openURL(url);

      this.props.onAfterFeedbackReceived();
    },

    render: function() {
      return (
        React.createElement("div", {className: "feedback-view-container"}, 
          React.createElement("h2", {className: "feedback-heading"}, 
            mozL10n.get("feedback_window_heading")
          ), 
          React.createElement("div", {className: "feedback-hello-logo"}), 
          React.createElement("div", {className: "feedback-button-container"}, 
            React.createElement("button", {onClick: this.onFeedbackButtonClick, 
              ref: "feedbackFormBtn"}, 
              mozL10n.get("feedback_request_button")
            )
          )
        )
      );
    }
  });

  return {
    FeedbackView: FeedbackView
  };
})(_, navigator.mozL10n || document.mozL10n);
