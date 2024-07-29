const DATA_ENTRY_SHEET_NAME = "Sheet1";

var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DATA_ENTRY_SHEET_NAME);

function doPost(request) {
  try {
    const { postData: { contents, type } = {} } = request;
    const data = parseFormData(contents);
    
    if (data["Image"]) {
      const imageUrl = uploadImageToDrive(data["Image"]);
      data["Image"] = imageUrl;
    }
    
    data["DateTime"] = new Date().toISOString(); 
    appendToGoogleSheet(data);

    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function parseFormData(postData) {
  const data = {};
  const parameters = postData.split('&');
  for (let i = 0; i < parameters.length; i++) {
    const [key, value] = parameters[i].split('=');
    data[key] = decodeURIComponent(value);
  }
  return data;
}

function appendToGoogleSheet(data) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const now = new Date();
  
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); 
  const year = now.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const formattedTime = `${hours}:${minutes}:${seconds}`;
  
  data["Date"] = formattedDate;
  data["Time"] = formattedTime;
  
  const rowData = headers.map(headerFld => data[headerFld] || '');
  sheet.appendRow(rowData);
}

function uploadImageToDrive(imageBase64) {
  const folderId = getFolderId();
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(imageBase64), 'image/jpeg', 'uploaded_image.jpg');
  const file = folder.createFile(blob);
  return file.getUrl();
}

function getFolderId() {
  return PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}
