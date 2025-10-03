// 自製 Liquid Glass 卷軸控制
(function () {
    const root = document.getElementById("lg-scroll-root");
    const content = document.getElementById("lg-scroll-content");
    const scrollbar = document.querySelector(".lg-scrollbar");
    const track = scrollbar.querySelector(".lg-scrollbar-track");
    const thumb = scrollbar.querySelector(".lg-scrollbar-thumb");

    let dragging = false;
    let startY, startScroll;

    function updateThumb() {
        const ratio = root.clientHeight / content.scrollHeight;
        const thumbHeight = Math.max(ratio * track.clientHeight, 30);
        thumb.style.height = `${thumbHeight}px`;
        thumb.style.top = `${(root.scrollTop / content.scrollHeight) * track.clientHeight}px`;
    }

    root.addEventListener("scroll", updateThumb);
    window.addEventListener("resize", updateThumb);

    thumb.addEventListener("mousedown", (e) => {
        dragging = true;
        startY = e.clientY;
        startScroll = root.scrollTop;
        document.body.classList.add("no-select");
    });

    document.addEventListener("mouseup", () => {
        dragging = false;
        document.body.classList.remove("no-select");
    });

    document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const dy = e.clientY - startY;
        const ratio = content.scrollHeight / track.clientHeight;
        root.scrollTop = startScroll + dy * ratio;
    });

    updateThumb();
})();
