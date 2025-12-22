import * as fs from 'fs';
import * as path from 'path';

/**
 * Load template file and replace placeholders
 */
export function loadTemplate(
  templateName: string,
  replacements: Record<string, string>
): string {
  const templatePath = path.join(__dirname, templateName);
  
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }
  
  let content = fs.readFileSync(templatePath, 'utf-8');
  
  // Replace all placeholders {{key}} with actual values
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, value);
  }
  
  return content;
}

/**
 * Load Android template
 */
export function loadAndroidTemplate(
  templateName: string,
  replacements: Record<string, string>
): string {
  return loadTemplate(path.join('android', templateName), replacements);
}

/**
 * Load iOS template
 */
export function loadIosTemplate(
  templateName: string,
  replacements: Record<string, string>
): string {
  return loadTemplate(path.join('ios', templateName), replacements);
}

