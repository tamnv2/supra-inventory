function doGet() {
  return ContentService
    .createTextOutput('SUPRA_APPS_SCRIPT_AUTOMATION_CANARY_V1')
    .setMimeType(ContentService.MimeType.TEXT);
}
