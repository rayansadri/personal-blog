(() => {
  const button = document.querySelector('.case-theme');
  if (!button) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    document.documentElement.dataset.theme = isDark ? 'light' : 'dark';
    const label = `Switch to ${isDark ? 'dark' : 'light'} theme`;
    button.setAttribute('aria-label', label);
    button.title = label;
  });
})();
