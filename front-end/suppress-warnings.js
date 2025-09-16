// Suppress specific deprecation warnings from dependencies
const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (
    typeof warning === 'string' &&
    (warning.includes('Buffer() is deprecated') ||
     warning.includes('url.parse()') ||
     warning.includes('Critical dependency'))
  ) {
    // Suppress these specific warnings
    return;
  }
  // Allow all other warnings to pass through
  return originalEmitWarning.call(process, warning, ...args);
};