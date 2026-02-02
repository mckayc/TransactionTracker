/**
 * Generates a UUID v4 string.
 * Uses crypto.randomUUID if available (secure contexts), otherwise falls back to a math-based generator.
 */
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Robustly copies text to the clipboard across secure and insecure contexts.
 * Modern browsers block navigator.clipboard on non-HTTPS origins (except localhost).
 * This utility uses a textarea fallback to ensure self-hosted local IPs work.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  // Try modern API first (requires secure context)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Modern clipboard API failed, attempting fallback...', err);
    }
  }

  // Robust Fallback: Textarea Selection Method
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Ensure the element is not visible but part of the DOM
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Unified clipboard failure:', err);
    return false;
  }
};