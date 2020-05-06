document.addEventListener("DOMContentLoaded", function() {
  if (RPMIsWindowPrivate()) {
    return;
  }

  document.getElementById("isNormalWindow").classList.remove("hidden");
  document.getElementById("isForgetWindow").classList.add("hidden");

  document
    .getElementById("startPrivateBrowsing")
    .addEventListener("click", function() {
      RPMSendAsyncMessage("OpenPrivateWindow");
    });
});
