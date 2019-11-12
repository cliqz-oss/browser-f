document.addEventListener("DOMContentLoaded", function() {
  if (!RPMIsWindowPrivate()) {
    document.getElementById("isNormalWindow").classList.remove("hidden");
    document.getElementById("isForgetWindow").classList.add("hidden");
    return;
  }
});
