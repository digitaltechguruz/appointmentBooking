(function () {
  var root = document.querySelector(
    "[data-ab-booking-widget], #ab-booking-widget-root",
  );
  if (!root || root.getAttribute("data-ab-loader-init") === "true") return;
  root.setAttribute("data-ab-loader-init", "true");

  var shop = root.getAttribute("data-shop") || "";
  var locale =
    root.getAttribute("data-locale") ||
    document.documentElement.lang ||
    "en";
  var settings = JSON.stringify({ locale: locale });

  var iframe = document.createElement("iframe");
  iframe.src =
    "/apps/booking/widget?shop=" +
    encodeURIComponent(shop) +
    "&settings=" +
    encodeURIComponent(settings);
  iframe.title = "Appointment Booking";
  iframe.setAttribute("loading", "lazy");
  iframe.setAttribute("scrolling", "yes");
  iframe.style.cssText =
    "width:100%;border:0;border-radius:0;display:block;overflow:auto;height:480px;max-height:90vh;min-height:0;transition:height .2s ease";

  root.textContent = "";
  root.appendChild(iframe);

  window.addEventListener("message", function (event) {
    if (!event.data || !event.data.type) return;
    if (event.source !== iframe.contentWindow) return;
    if (event.data.type === "ab-booking-widget-resize") {
      var contentHeight = Number(event.data.height);
      if (contentHeight > 0) {
        var maxHeight = Math.floor(window.innerHeight * 0.9);
        iframe.style.height = Math.min(contentHeight, maxHeight) + "px";
        iframe.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
      }
      return;
    }
    if (event.data.type === "ab-booking-widget-scroll") {
      iframe.scrollIntoView({
        behavior: "smooth",
        block: event.data.block || "start",
      });
    }
  });
})();
