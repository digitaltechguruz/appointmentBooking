import { TRANSLATION_FIELDS } from "./widget-text.constants.js";

const FALLBACK_DEFINITION_NAME = "Book appointment widget text";
const FALLBACK_LANGUAGE_FIELD_NAME = "Widget language";

export async function loadWidgetDefinitionLabels(uiLocale = "en") {
  void uiLocale;
  return {
    definitionName: FALLBACK_DEFINITION_NAME,
    languageFieldName: FALLBACK_LANGUAGE_FIELD_NAME,
    languageNames: {},
    fields: TRANSLATION_FIELDS.map((field) => ({
      key: field.key,
      name: field.label,
    })),
  };
}
