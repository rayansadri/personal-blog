(() => {
  const brands = [
    { name: "ERA", image: "era.jpg", href: "https://www.eranyc.com/", style: "era" },
    { name: "Creative Destruction Lab", image: "cdl-transparent.png", href: "https://creativedestructionlab.com/", style: "cdl" },
    { name: "NEXT36", image: "next36.png", href: "https://www.nextcanada.com/", style: "next36" },
    { name: "NVIDIA Inception", image: "nvidia.png", href: "https://www.nvidia.com/en-us/startups/", style: "nvidia" }
  ];
  const host = document.getElementById("elsewhere-modern");
  if (!host) return;
  // The existing portfolio bundle mounts this section asynchronously.
  function addLogos() {
    const row = host.querySelector(".el-support");
    if (!row) return false;
    row.classList.add("backer-logos");
    row.replaceChildren(...brands.map(brand => {
      const link = document.createElement("a");
      link.className = `backer-logo backer-${brand.style}`;
      link.href = brand.href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = brand.name;
      link.setAttribute("aria-label", `${brand.name} (opens in a new tab)`);
      const image = document.createElement("img");
      image.src = `assets/brand-logos/${brand.image}`;
      image.alt = brand.name;
      image.loading = "lazy";
      link.append(image);
      return link;
    }));
    return true;
  }
  if (!addLogos()) {
    const observer = new MutationObserver(() => {
      if (addLogos()) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });
  }
})();
