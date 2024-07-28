function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('prompt.html'); 
}

function onOpen() {
  Logger.log('onOpen function executed'); 
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu('Update')
    .addItem('Update Permissions', 'updatePermissionsFromSheet') 
    .addToUi();
}

function showPrompt() {
  var html = HtmlService.createHtmlOutputFromFile('prompt')
    .setWidth(300)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Number of subfolder(s)');
}

function validateUserInput(data) {
  var numSubfolders = parseInt(data.numSubfolders, 10);
  if (isNaN(numSubfolders) || numSubfolders <= 0) {
    return 'Please enter a valid number of subfolders (positive integer).';
  }
  if (data.operationType === 'existing' && !data.spreadsheetId) {
    return 'Please select an existing spreadsheet.';
  }
  return null; 
}

function processUserInput(data) {
  var errorMessage = validateUserInput(data);
  if (errorMessage) {
    SpreadsheetApp.getUi().alert(errorMessage);
    return;
  }
  var mainFolderName = data.mainFolderName;
  var numSubfolders = data.numSubfolders;
  var subfolderNames = [];
  for (var i = 1; i <= numSubfolders; i++) {
    subfolderNames.push(data['subfolder' + i]);
  }
  var newSpreadsheet;
  if (data.operationType === 'new') {
    newSpreadsheet = createSheetWithTemplate(subfolderNames, data.mainFolderName);
    createDriveFolders(subfolderNames, true, data.mainFolderName);
  } else if (data.operationType === 'existing') {
    newSpreadsheet = SpreadsheetApp.openById(data.spreadsheetId);
    appendToExistingSheet(newSpreadsheet, subfolderNames);
    createDriveFolders(subfolderNames, false, data.mainFolderName);
  }
  return newSpreadsheet.getUrl();
}

function createSheetWithTemplate(subfolderNames, mainFolderName) {
  var spreadsheetName = mainFolderName + "'s Collaboration Folder";
  var newSpreadsheet = SpreadsheetApp.create(spreadsheetName);
  var sheet = newSpreadsheet.getActiveSheet();
  var headers = ['Name', 'Email'];
  headers = headers.concat(subfolderNames);
  sheet.appendRow(headers);
  
  var subfolderStartColumn = 3; 

  if (!subfolderNames || subfolderNames.length === 0) {
    Logger.log("No subfolders provided, exiting function.");
    return;
  }
  
  for (var i = 0; i < subfolderNames.length; i++) {
    var subfolderRange = sheet.getRange(2, subfolderStartColumn + i, sheet.getMaxRows() - 1, 1);
    subfolderRange.insertCheckboxes();
  }
  
  Logger.log('New Google Sheet created with URL: ' + newSpreadsheet.getUrl());
  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(newSpreadsheet)
    .onOpen()
    .create();
  return newSpreadsheet;
}

function appendToExistingSheet(spreadsheet, subfolderNames) {
  var sheet = spreadshetet.getActiveSheet();
  var lastColumn = sheet.getLastColumn();
  
  for (var i = 0; i < subfolderNames.length; i++) {
    sheet.getRange(1, lastColumn + 1 + i).setValue(subfolderNames[i]);
  }
  
  var subfolderStartColumn = lastColumn + 1;
  for (var j = 0; j < subfolderNames.length; j++) {
    var subfolderRange = sheet.getRange(2, subfolderStartColumn + j, sheet.getMaxRows() - 1, 1);
    subfolderRange.insertCheckboxes();
  }
  Logger.log('Existing Google Sheet updated with new subfolder columns.');

}

function createDriveFolders(subfolderNames, isNewMainFolder, mainFolderName) {
  var mainFolder;
  if (isNewMainFolder) {
    mainFolder = DriveApp.createFolder(mainFolderName);
    Logger.log('Created new main folder: ' + mainFolder.getName());
  } else {
    var folders = DriveApp.getFoldersByName(mainFolderName);
    if (folders.hasNext()) {
      mainFolder = folders.next();
    } else {
      mainFolder = DriveApp.createFolder(mainFolderName);
      Logger.log('Created new main folder: ' + mainFolder.getName());
    }
  }
  
  for (var i = 0; i < subfolderNames.length; i++) {
    var folder = mainFolder.createFolder(subfolderNames[i]);
    Logger.log('Created subfolder: ' + folder.getName());
  }
}

function getSpreadsheetFiles() {
  var files = DriveApp.getFilesByType(MimeType.GOOGLE_SHEETS);
  var fileList = [];
  while (files.hasNext()) {
    var file = files.next();
    fileList.push({ id: file.getId(), name: file.getName() });
  }
  return fileList;
}



function updatePermissionsFromSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  var data = sheet.getDataRange().getValues();

  var logSheet = spreadsheet.getSheetByName('Log');
  if (!logSheet) {
    logSheet = spreadsheet.insertSheet('Log');
    logSheet.appendRow(['Timestamp', 'Name', 'Email', 'Status', 'Message']);
  }

  var mainFolderName = spreadsheet.getName().replace("'s Collaboration Folder", "").trim();
  Logger.log(`Main folder name derived: ${mainFolderName}`);

  const mainFolderIterator = DriveApp.getFoldersByName(mainFolderName);
  if (!mainFolderIterator.hasNext()) {
    Logger.log(`Main folder "${mainFolderName}" not found.`);
    logSheet.appendRow([new Date(), '', '', 'Error', `Main folder "${mainFolderName}" not found.`]); 
    return;
  }

  const mainFolder = mainFolderIterator.next();
  Logger.log(`Main folder found: ${mainFolder.getName()}`);

  var subfolderStartColumn = 2; 
  for (var i = 1; i < data.length; i++) {
    var name = data[i][0];
    var email = data[i][1];
    if (!email) 
      continue; 

    try {
      for (var j = subfolderStartColumn; j < data[i].length; j++) {
        var subfolderName = data[0][j];
        var subfolderIterator = mainFolder.getFoldersByName(subfolderName);

        if (!subfolderIterator.hasNext()) {
          Logger.log(`Subfolder "${subfolderName}" not found.`);
          logSheet.appendRow([new Date(), name, email, 'Error', `Subfolder "${subfolderName}" not found.`]);
          continue;
        }

        var subfolder = subfolderIterator.next();
        var editors = subfolder.getEditors().map(user => user.getEmail());
        var viewers = subfolder.getViewers().map(user => user.getEmail());

        var addAsEditor = data[i][j] === true; 

        if (addAsEditor) {
          if (!editors.includes(email)) {
            subfolder.addEditor(email); 
            logSheet.appendRow([new Date(), name, email, 'Success', `Added as editor to ${subfolderName}`]);
            Logger.log(`Added ${email} as editor to ${subfolderName}`);
          }
        } else {
          if (editors.includes(email)) {
            subfolder.removeEditor(email); 
            logSheet.appendRow([new Date(), name, email, 'Success', `Removed from ${subfolderName}`]);
            Logger.log(`Removed ${email} from ${subfolderName}`);
          } else if (viewers.includes(email)) {
            subfolder.removeViewer(email); 
            logSheet.appendRow([new Date(), name, email, 'Success', `Removed from ${subfolderName}`]);
            Logger.log(`Removed ${email} from ${subfolderName}`);
          }
        }
      }
    } catch (e) {
      logSheet.appendRow([new Date(), name, email, 'Error', e.message]);
      Logger.log(`Error processing user ${email}: ${e.message}`);
    }
  }
  Logger.log('Permissions updated based on the sheet.');
}

function main() {
  showPrompt();
}
