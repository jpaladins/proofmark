// Applies the saved or system theme before first paint (external file: the CSP forbids inline scripts).
try {
  var t = localStorage.getItem('pm-theme')
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark')
  }
} catch {
  if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark')
}
