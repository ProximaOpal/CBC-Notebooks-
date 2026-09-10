const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin(email, password) {
  if (!EMAIL_RE.test(email)) return "Enter a valid email address";
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  return "";
}

export function validateRegister(name, email, password) {
  if (!name || name.trim().length < 2) return "Name must be at least 2 characters";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address";
  if (!password || password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Include a letter";
  if (!/[0-9]/.test(password)) return "Include a number";
  return "";
}
