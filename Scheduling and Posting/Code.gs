function doGet(e) {
  if (e && e.parameter && e.parameter.code) {
    return handleCallback(e);
  } else {
    return HtmlService.createHtmlOutputFromFile('Index')
  }
}

function createSpreadsheet() {
  var spreadsheet = SpreadsheetApp.create("BizSavvy Content Scheduling");
  var sheet = spreadsheet.getActiveSheet();
  
  /**added smtg here**/
  var headers = ["Content Title", "Content Description", "Status", "Facebook", "Instagram", "LinkedIn","Post Images", "Post Caption", "Posting Date", "Posting Time", "PIC Email", "Facebook Page ID", "Facebook Access Token", "Facebook Post ID", "Instagram Account ID", "Instagram Page Token", "Instagram Post ID"];
  sheet.appendRow(headers);
  
  formatTemplateSheet(sheet);
  formatDateTime(sheet);

  return spreadsheet.getUrl();
}

function getOAuthToken() {
  try {
    DriveApp.getRootFolder();
    return ScriptApp.getOAuthToken();
  } catch (e) {
    console.error('Error in getOAuthToken:', e);
    return { error: e.toString() };
  }
}

function getImageAsBase64(imageId) {
  try {
    var file = DriveApp.getFileById(imageId);
    var blob = file.getBlob();
    var base64String = Utilities.base64Encode(blob.getBytes());
    var mimeType = blob.getContentType();
    return JSON.stringify({
      base64: base64String,
      mimeType: mimeType
    });
  } catch (error) {
    console.error('Error getting image:', error);
    return null;
  }
}

function processForm(formData, action) {
  var url;
  var spreadsheet;
  var sheet;

  if (action === 'new') {
    url = createSpreadsheet();
    PropertiesService.getScriptProperties().setProperty("spreadsheetUrl", url);
    spreadsheet = SpreadsheetApp.openByUrl(url);
  } else if (action === 'existing') {
    url = PropertiesService.getScriptProperties().getProperty("spreadsheetUrl");
    try {
      var file = DriveApp.getFileById(getIdFromUrl(url));
      if (file.isTrashed()) {
        url = createSpreadsheet();
        PropertiesService.getScriptProperties().setProperty("spreadsheetUrl", url);
        spreadsheet = SpreadsheetApp.openByUrl(url);
      } else {
        spreadsheet = SpreadsheetApp.openByUrl(url);
      }
    } catch (e) {
      // If there's any error (like file not found), create a new spreadsheet
      url = createSpreadsheet();
      PropertiesService.getScriptProperties().setProperty("spreadsheetUrl", url);
      spreadsheet = SpreadsheetApp.openByUrl(url);
    }
  }

  sheet = spreadsheet.getActiveSheet();

  /**added smtg here**/
  var facebookChecked = formData.platform && formData.platform.includes("Facebook") ? true : false;
  var instagramChecked = formData.platform && formData.platform.includes("Instagram") ? true : false;
  var linkedinChecked = formData.platform && formData.platform.includes("Linkedin") ? true : false;
  console.log(facebookChecked);

  var imageUrls = [];
  if (formData.selectedImages && formData.selectedImages.length > 0) {
    Logger.log('Processing Drive images');
    imageUrls = formData.selectedImages.map(image => {
      try {
        var fileUrl = 'https://drive.google.com/uc?export=view&id=' + image.id;
        Logger.log('Retrieved file URL: ' + fileUrl);
        return fileUrl;
      } catch (e) {
        Logger.log('Error retrieving file: ' + e.message);
        return '';
      }
    }).filter(url => url !== ''); 
  }

  var imageLinks = imageUrls.length > 0 ? 
    '=HYPERLINK("' + imageUrls.join('")&CHAR(10)&HYPERLINK("') + '")' : 
    '';

  var postingDate = new Date(formData.postingDate + ' ' + formData.postingTime);
  var facebookPageId = formData.facebookPageId || '';
  var facebookAccessToken = formData.facebookAccessToken || '';
  var instagramAccountId = formData.instagramAccountId || '';
  var instagramAssociatedPageToken = formData.instagramAssociatedPageToken || '';

  sheet.appendRow([
    formData.contentTitle,
    formData.description,
    formData.status,
    facebookChecked,
    instagramChecked,
    linkedinChecked,
    imageLinks,
    formData.caption,
    formData.postingDate,
    formData.postingTime,
    formData.picEmail,
    facebookPageId,
    facebookAccessToken,
    '',
    instagramAccountId,
    instagramAssociatedPageToken,
    ''
  ]);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 4).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  sheet.getRange(lastRow, 5).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  sheet.getRange(lastRow, 6).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());

  sendNotification(formData.picEmail, formData.contentTitle, formData.description, postingDate);

  var calendarUrl = createCalendarEvent(formData);
  sheet.autoResizeColumns(1, 17);
  manageTrigger();

  return { spreadsheetUrl: spreadsheet.getUrl(), calendarUrl: calendarUrl };
}

function getIdFromUrl(url) {
  return url.match(/[-\w]{25,}/);
}

function formatTemplateSheet(sheet) {
  var formats = {
    "Content Title": { format: "text" },
    "Content Description": { format: "text" },
    "Status": {
      format: "list",
      options: ["In Progress", "Under Review", "Published"]
    },
    "Facebook": { format: "text" },
    "Instagram": { format: "text" },
    "LinkedIn": { format: "text" },
    "Post Images": {format: "text"},
    "Post Caption": {format: "text"},
    "Posting Date": { format: "date" },
    "Posting Time": { format: "time" },
    "PIC Email": { format: "text" },
    "Facebook Page ID": { format: "text" },
    "Facebook Access Token": { format: "text" },
    "Facebook Post ID": { format: "text" },
    "Instagram Account ID": { format: "text" },
    "Instagram Page Token": { format: "text" },
    "Instagram Post ID": { format: "text" }
  };

  var headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  headerRange.setBackground('#96d2ff').setFontColor('#001a2e').setBorder(
      true, true, true, true, null, null,null,SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 17);
  
  for (var col = 1; col <= headerRange.getNumColumns(); col++) {
    var columnName = headerRange.getCell(1, col).getValue();
    var columnFormat = formats[columnName];
    
    if (columnFormat) {
      var columnRange = sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
      switch (columnFormat.format) {
        case "text":
          columnRange.setNumberFormat("@");
          break;
        case "list":
          var rule = SpreadsheetApp.newDataValidation().requireValueInList(columnFormat.options).build();
          columnRange.setDataValidation(rule);
          break;
        case "date":
          columnRange.setNumberFormat("dd-MM-yyyy");
          break;
        case "time":
          columnRange.setNumberFormat("hh:mm AM/PM");
          break;
      }
    }
  }
}

function formatDateTime(sheet) {
  var dateColumn = sheet.getRange("D2:D");
  var timeColumn = sheet.getRange("E2:E");

  dateColumn.setNumberFormat("dd-MM-yyyy");
  timeColumn.setNumberFormat("hh:mm AM/PM");
}

function createCalendarEvent(formData) {
  var calendarId = PropertiesService.getScriptProperties().getProperty("calendarId");
  if (!calendarId) {
    var calendar = CalendarApp.createCalendar('BizSavvy Content Calendar');
    calendarId = calendar.getId();
    PropertiesService.getScriptProperties().setProperty("calendarId", calendarId);
  }

  var calendar = CalendarApp.getCalendarById(calendarId);

  var postingDate = new Date(formData.postingDate);
  var postingTime = formData.postingTime.split(':');
  postingDate.setHours(postingTime[0]);
  postingDate.setMinutes(postingTime[1]);

  calendar.createEvent(
    formData.contentTitle,
    postingDate,
    new Date(postingDate.getTime() + 60 * 60 * 1000), 
    {
      description: formData.description,
      location: formData.details
    }
  );

  return "https://calendar.google.com/calendar/u/0/r?cid=" + calendarId;
}

function showDatePicker() {
  var html = HtmlService.createHtmlOutputFromFile('DatePicker')
      .setWidth(300)
      .setHeight(200);
  SpreadsheetApp.getUi().showSidebar(html);
}

function submitSelectedDate(date) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var cell = sheet.getActiveCell();
  cell.setValue(new Date(date));
}

function onEdit(e) {
  var range = e.range;
  var sheet = e.source.getActiveSheet();
  
  var dateColumn = 4;

  if (range.getColumn() == dateColumn) {
    var value = range.getValue();
    if (!isValidDate(value)) {
      Browser.msgBox('Invalid date entered. Please select a valid date.');
      showDatePicker();
    }
  }
}

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

function sendNotification(email, contentTitle, description, postingDate) {
  var subject = "New Task Assigned: " + contentTitle;

  var message = `
    Hi,

    You have been assigned to manage the content titled '${contentTitle}'.

    Description: ${description}
    Posting Date: ${postingDate.toDateString()}
    Posting Time: ${postingDate.toLocaleTimeString()}

    Please review and prepare for its scheduled posting. 

    Thank you.

    Best regards,
    BizSavvy Content Scheduling System
  `;

  MailApp.sendEmail(email, subject, message);

  // Schedule reminder 30 minutes before the posting date and time
  var reminderDate = new Date(postingDate.getTime() - (30 * 60 * 1000));
  ScriptApp.newTrigger("sendReminder")
    .timeBased()
    .at(reminderDate)
    .create();
}

function sendReminder() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();

  data.forEach(function(row) {
    var postingDate = new Date(row[3] + ' ' + row[4]);
    var email = row[5];

    if (postingDate - now <= 30 * 60 * 1000 && postingDate - now > 0) {
      var subject = "Reminder: Upcoming Task for " + row[0];
      var message = "This is a reminder that the content titled '" + row[0] + 
                    "' is scheduled to be posted in 30 minutes.";
      MailApp.sendEmail(email, subject, message);
    }
  });
}

function getAuthorizationUrl() {
  var facebookService = getFacebookService();
  facebookService.reset();
  var authorizationUrl = facebookService.getAuthorizationUrl();
  return authorizationUrl;
}

function handleCallback(request) {
  console.log('Callback received:', request);
  var facebookService = getFacebookService();
  var isAuthorized = facebookService.handleCallback(request);
  console.log('Is authorized:', isAuthorized);
  if (isAuthorized) {
    var output = HtmlService.createHtmlOutput('Success! You can close this tab.');
    output.append('<script>' +
      'console.log("Setting login success flag");' +
      'localStorage.setItem("facebook_login_success", "true");' +
      'setTimeout(function() {' +
        'window.close();' +
      '}, 1000);' + // Delay closing by 1 second
    '</script>');
    return output;
  } else {
    return HtmlService.createHtmlOutput('Authorization failed.');
  }
}

function getFacebookService() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var clientId = scriptProperties.getProperty('FACEBOOK_CLIENT_ID');
  var clientSecret = scriptProperties.getProperty('FACEBOOK_CLIENT_SECRET');
  
  return OAuth2.createService('facebook')
    .setAuthorizationBaseUrl('https://www.facebook.com/v20.0/dialog/oauth')
    .setTokenUrl('https://graph.facebook.com/v20.0/oauth/access_token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction('authCallback')
    .setCache(CacheService.getUserCache())
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('public_profile,email,manage_pages,pages_show_list,ads_management')
    .setTokenHeaders({ 'Authorization': 'Bearer ' });
}

function getUserInfo() {
  var authStatus = handleTokenExpiration();
  if (authStatus.needsReauth) {
    return { needsReauth: true, authUrl: authStatus.authUrl };
  }

  var facebookService = getFacebookService();
  if (facebookService.hasAccess()) {
    try {
      var userUrl = 'https://graph.facebook.com/v20.0/me?fields=id,name,email';
      var userResponse = UrlFetchApp.fetch(userUrl, {
        headers: {
          Authorization: 'Bearer ' + facebookService.getAccessToken()
        }
      });
      var userResult = JSON.parse(userResponse.getContentText());
      console.log('User Result:', userResult);

      var pagesUrl = 'https://graph.facebook.com/v20.0/me/accounts?fields=name,access_token,id';
      var pagesResponse = UrlFetchApp.fetch(pagesUrl, {
        headers: {
          Authorization: 'Bearer ' + facebookService.getAccessToken()
        }
      });
      var pagesResult = JSON.parse(pagesResponse.getContentText());
      console.log('Pages Result:', pagesResult);

      var pages = pagesResult.data.map(function(page) {
        var pageInfo = {
          id: page.id,
          name: page.name,
          access_token: page.access_token
        };

        try {
          var instagramUrl = 'https://graph.facebook.com/v20.0/' + page.id + '?fields=instagram_business_account';
          var instagramResponse = UrlFetchApp.fetch(instagramUrl, {
            headers: {
              Authorization: 'Bearer ' + facebookService.getAccessToken()
            }
          });
          var instagramResult = JSON.parse(instagramResponse.getContentText());
          console.log('Instagram Result for page ' + page.id + ':', instagramResult);

          if (instagramResult.instagram_business_account) {
            pageInfo.instagram_business_account = instagramResult.instagram_business_account;
            var igAccountUrl = 'https://graph.facebook.com/v20.0/' + instagramResult.instagram_business_account.id + '?fields=id,username&access_token=' + facebookService.getAccessToken();
            var igAccountResponse = UrlFetchApp.fetch(igAccountUrl);
            var igAccountResult = JSON.parse(igAccountResponse.getContentText());
            pageInfo.instagram_id = igAccountResult.id;
            pageInfo.instagram_username = igAccountResult.username;
          }
        } catch (instagramError) {
          console.log('Error fetching Instagram info for page ' + page.id + ':', instagramError);
        }

        return pageInfo;
      });

      return {
        user: userResult,
        pages: pages,
      };

    } catch (error) {
      console.error('Error in getUserInfo:', error);
      return { error: error.toString() };
    }
  } else {
    return { error: 'No access token' };
  }
}

function logout() {
  var facebookService = getFacebookService();
  facebookService.reset();
  return { loggedOut: true };
}

function isTokenValid() {
  var facebookService = getFacebookService();
  if (facebookService.hasAccess()) {
    try {
      var url = 'https://graph.facebook.com/v20.0/me?fields=id';
      var response = UrlFetchApp.fetch(url, {
        headers: {
          Authorization: 'Bearer ' + facebookService.getAccessToken()
        }
      });
      return response.getResponseCode() === 200;
    } catch (error) {
      console.error('Error checking token validity:', error);
      return false;
    }
  }
  return false;
}

function refreshToken() {
  var facebookService = getFacebookService();
  if (facebookService.hasAccess()) {
    try {
      facebookService.refresh();
      return true;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }
  return false;
}

function handleTokenExpiration() {
  if (!isTokenValid()) {
    if (!refreshToken()) {
      // If refresh fails, we need to re-authenticate
      var authInfo = {
        authUrl: getAuthorizationUrl(),
        needsReauth: true
      };
      return authInfo;
    }
  }
  return { needsReauth: false };
}

function postToFacebook(row, rowIndex, sheet) {
  var caption = row[7]; 
  var imageUrls = row[6].split('https://').filter(Boolean).map(url => 'https://' + url.trim());
  var facebookPageId = row[11]; 
  var facebookAccessToken = row[12]; 

  var postResult = postToFacebookPage(facebookPageId, facebookAccessToken, caption, imageUrls);
  
  if (postResult.success) {
    Logger.log('Posted to Facebook: ' + caption);
    sheet.getRange(rowIndex, 14).setValue(postResult.id); 
    return postResult.id;
  } else {
    Logger.log('Failed to post to Facebook: ' + caption + '. Error: ' + postResult.error);
    sheet.getRange(rowIndex, 3).setValue('Failed');
    return null;
  }
}

function postToFacebookPage(pageId, accessToken, caption, imageUrls) {
  var url = 'https://graph.facebook.com/v20.0/' + pageId + '/photos';
  var message = caption;
  
  try {
    if (imageUrls.length === 0) {
      url = 'https://graph.facebook.com/v20.0/' + pageId + '/feed';
      var payload = {
        'message': message,
        'access_token': accessToken
      };
      return makeRequest(url, payload);
    } else if (imageUrls.length === 1) {
      var payload = {
        'message': message,
        'url': imageUrls[0],
        'access_token': accessToken
      };
      Logger.log('Facebook Photo Post Payload: ' + JSON.stringify(payload));
      return makeRequest(url, payload);
    } else {
      var attachments = imageUrls.map(function(imageUrl) {
        return {'media_fbid': createPhotoAttachment(pageId, accessToken, imageUrl)};
      });

      url = 'https://graph.facebook.com/v20.0/' + pageId + '/feed';
      var payload = {
        'message': message,
        'attached_media': JSON.stringify(attachments),
        'access_token': accessToken
      };
      Logger.log('Facebook Multi-Photo Post Payload: ' + JSON.stringify(payload));
      return makeRequest(url, payload);
    }
  } catch (error) {
    Logger.log('Error in postToFacebookPage: ' + error.message);
    return { success: false, error: error.toString() };
  }
}

function createPhotoAttachment(pageId, accessToken, imageUrl) {
  var url = 'https://graph.facebook.com/v20.0/' + pageId + '/photos';
  var payload = {
    'url': imageUrl,
    'published': 'false',
    'access_token': accessToken
  };
  
  try {
    var response = UrlFetchApp.fetch(url, {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true
    });
    
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();
    
    if (responseCode === 200) {
      var result = JSON.parse(responseText);
      return result.id;
    } else {
      console.error('Facebook API error. Response code:', responseCode, 'Response:', responseText);
      throw new Error('Failed to create photo attachment. Facebook API error: ' + responseText);
    }
  } catch (error) {
    console.error('Error in createPhotoAttachment:', error);
    throw new Error('Failed to create photo attachment: ' + error.toString());
  }
}

function postToInstagram(row, rowIndex, sheet) {
  var caption = row[7]; 
  var imageUrls = row[6].split('https://').filter(Boolean).map(url => 'https://' + url.trim());
  var instagramBusinessAccountId = row[14]; 
  var instagramAssociatedPageToken = row[15]; 
  
  try {
    if (imageUrls.length === 0) {
      throw new Error('No images provided for Instagram post');
    }

    var containerId = createMediaContainer(instagramBusinessAccountId, imageUrls, caption, instagramAssociatedPageToken);

    var postId = publishMediaContainer(instagramBusinessAccountId, containerId, instagramAssociatedPageToken);

    Logger.log('Posted to Instagram. Post ID: ' + postId);
    sheet.getRange(rowIndex, 3).setValue('Published');
    sheet.getRange(rowIndex, 17).setValue(postId); 
    return postId;
  } catch (error) {
    Logger.log('Failed to post to Instagram: ' + caption + '. Error: ' + error.message);
    sheet.getRange(rowIndex, 3).setValue('Failed');
    return null;
  }
}

function createMediaContainer(instagramBusinessAccountId, imageUrls, caption, accessToken) {
  var url = `https://graph.facebook.com/v20.0/${instagramBusinessAccountId}/media`;
  
  try {
    if (imageUrls.length === 1) {
      // Single image post
      var payload = {
        'image_url': imageUrls[0],
        'caption': caption,
        'access_token': accessToken
      };
      
      var response = UrlFetchApp.fetch(url, {
        method: 'POST',
        payload: payload,
        muteHttpExceptions: true
      });
      
      var result = JSON.parse(response.getContentText());
      if (result.error) throw new Error(result.error.message);
      if (!result.id) throw new Error('Media ID not returned by Instagram API');
      return result.id;
    } else {
      // Carousel post (multiple images)
      var childrenMediaIds = imageUrls.map(function(imageUrl) {
        var childPayload = {
          'image_url': imageUrl,
          'is_carousel_item': 'true',
          'access_token': accessToken
        };
        
        var childResponse = UrlFetchApp.fetch(url, {
          method: 'POST',
          payload: childPayload,
          muteHttpExceptions: true
        });
        
        var childResult = JSON.parse(childResponse.getContentText());
        if (childResult.error) throw new Error(childResult.error.message);
        return childResult.id;
      });
      
      var carouselPayload = {
        'media_type': 'CAROUSEL',
        'children': childrenMediaIds.join(','),
        'caption': caption,
        'access_token': accessToken
      };
    }
      var carouselResponse = UrlFetchApp.fetch(url, {
        method: 'POST',
        payload: carouselPayload,
        muteHttpExceptions: true
      });
      
      var carouselResult = JSON.parse(carouselResponse.getContentText());
      if (carouselResult.error) throw new Error(carouselResult.error.message);
      if (!carouselResult.id) throw new Error('Carousel Media ID not returned by Instagram API');
      
      return carouselResult.id;
    } catch (error) {
    Logger.log('Error in createMediaContainer: ' + error.message);
    throw new Error('Failed to create media container: ' + error.toString());
  }
  }

function publishMediaContainer(instagramBusinessAccountId, containerId, accessToken) {
  var url = `https://graph.facebook.com/v20.0/${instagramBusinessAccountId}/media_publish`;
  var payload = {
    'creation_id': containerId,
    'access_token': accessToken
  };
  
  var response = UrlFetchApp.fetch(url, {
    method: 'POST',
    payload: payload,
    muteHttpExceptions: true
  });
  
  var result = JSON.parse(response.getContentText());
  if (result.error) throw new Error(result.error.message);
  return result.id;
}

function makeRequest(url, payload) {
  var options = {
    'method': 'post',
    'payload': payload
  };

  try {
    
    var response = UrlFetchApp.fetch(url, options);
    Logger.log('Request URL: ' + url);
    Logger.log('Request Payload: ' + JSON.stringify(payload));
    Logger.log('Response Code: ' + response.getResponseCode());
    Logger.log('Response: ' + response.getContentText());
    var result = JSON.parse(response.getContentText());
    return { success: true, id: result.id };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function processQueue() {
  var spreadsheetUrl = PropertiesService.getScriptProperties().getProperty("spreadsheetUrl");
  if (!spreadsheetUrl) {
    Logger.log('Spreadsheet URL not found');
    return;
  }

  var spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
  var sheet = spreadsheet.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var now = new Date();

  var inProgressRows = data.filter((row, index) => {
    row.originalIndex = index + 1; 
    return row[2] === "In Progress"; 
  });


  for (var i = 0; i < inProgressRows.length; i++) {
    var row = inProgressRows[i];
    var originalRowIndex = row.originalIndex;

    try {
      var dateValue = row[8]; 
      var timeValue = row[9]; 

      if (dateValue && timeValue) {
        var postingDate = new Date(dateValue);
        postingDate.setHours(timeValue.getHours());
        postingDate.setMinutes(timeValue.getMinutes())

        if (Math.abs(now - postingDate) <= 5 * 60 * 1000) {
          var facebookChecked = row[3]; 
          var instagramChecked = row[4]; 
          var linkedinChecked = row[5]; 

          if (facebookChecked) {
            facebookPostId = postToFacebook(row, originalRowIndex, sheet);
            if (facebookPostId) {
              sheet.getRange(originalRowIndex, 3).setValue('Published');
            }
          }

          if (instagramChecked) {
            instagramPostId = postToInstagram(row, originalRowIndex, sheet);
            if (instagramPostId) {
              sheet.getRange(originalRowIndex, 3).setValue('Published');
            }
          }

          if (linkedinChecked) {
            sheet.getRange(originalRowIndex, 3).setValue('Published');
          }
        }
      }
    } catch (error) {
      Logger.log('Error processing row ' + originalRowIndex + ': ' + error.message);
      sheet.getRange(originalRowIndex, 3).setValue('Error');
    }
  }
  return inProgressRows.length > 0;
}

function createInitialTrigger() {
  deleteExistingTriggers();
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'manageTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('manageTrigger')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function manageTrigger() {
  var hasInProgressItems = processQueue();
  deleteExistingTriggers();

  if (hasInProgressItems) {
    ScriptApp.newTrigger('manageTrigger')
      .timeBased()
      .everyMinutes(5)
      .create();
    Logger.log('New trigger created due to "In Progress" items');
  }
}

function deleteExistingTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processQueue' || 
        triggers[i].getHandlerFunction() === 'manageTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('Deleted trigger for ' + triggers[i].getHandlerFunction());
    }
  }
}

function getOrCreateAnalyticsSpreadsheet() {
  var scriptProperties = PropertiesService.getScriptProperties();
  var analyticsSpreadsheetId = scriptProperties.getProperty("analyticsSpreadsheetId");
  
  if (analyticsSpreadsheetId) {
    try {
      var file = DriveApp.getFileById(analyticsSpreadsheetId);
      
      if (file.isTrashed()) {
        console.log("Existing analytics spreadsheet is in trash. Creating a new one.");
        return createNewAnalyticsSpreadsheet(scriptProperties);
      }

      var spreadsheet = SpreadsheetApp.openById(analyticsSpreadsheetId);
      return spreadsheet;
    } catch (e) {
      // If the spreadsheet doesn't exist or is inaccessible, create a new one
      console.log("Existing analytics spreadsheet not found. Creating a new one.");
    }
  }
  
  console.log("Creating new analytics spreadsheet");
  var newSpreadsheet = SpreadsheetApp.create("BizSavvy Content Analytics");
  scriptProperties.setProperty("analyticsSpreadsheetId", newSpreadsheet.getId());
  
  newSpreadsheet.insertSheet("Facebook Post Analytics");
  newSpreadsheet.insertSheet("Instagram Post Analytics");
  newSpreadsheet.insertSheet("Facebook Overall Analytics");
  newSpreadsheet.insertSheet("Instagram Overall Analytics");

  var sheet1 = newSpreadsheet.getSheetByName("Sheet1");
  if (sheet1) {
    newSpreadsheet.deleteSheet(sheet1);
  }
  
  return newSpreadsheet;
}

function collectAnalytics() {
  console.log("Starting collectAnalytics function");
  var analyticsSpreadsheet = getOrCreateAnalyticsSpreadsheet();
  var facebookPostSheet = analyticsSpreadsheet.getSheetByName("Facebook Post Analytics");
  var instagramPostSheet = analyticsSpreadsheet.getSheetByName("Instagram Post Analytics");
  var facebookOverallSheet = analyticsSpreadsheet.getSheetByName("Facebook Overall Analytics");
  var instagramOverallSheet = analyticsSpreadsheet.getSheetByName("Instagram Overall Analytics");
  
  ensureHeaders(facebookPostSheet, ["Date", "Date Published", "Content Title", "Post ID", "Page ID", "Impressions", "Reactions"]);
  ensureHeaders(instagramPostSheet, ["Date", "Date Published", "Content Title", "Post ID", "Page ID", "Impressions", "Engagement"]);
  ensureHeaders(facebookOverallSheet, ["Date","Page ID", "Page Impressions", "Page Total Actions", "Page Post Engagements", "Page Fans Add", "Page Fans Remove", "Page Views"]);
  ensureHeaders(instagramOverallSheet, ["Date", "Account ID", "Impressions", "Reach", "Accounts Engaged", "Profile Views"]);
  
  var contentSpreadsheetUrl = PropertiesService.getScriptProperties().getProperty("spreadsheetUrl");
  var contentSpreadsheet = SpreadsheetApp.openByUrl(contentSpreadsheetUrl);
  var contentSheet = contentSpreadsheet.getActiveSheet();
  var data = contentSheet.getDataRange().getValues();

  console.log("Content spreadsheet URL:", contentSpreadsheetUrl);

  var facebookPosts = [];
  var instagramPosts = [];
  var facebookPages = new Set();
  var instagramAccounts = new Set();
  var facebookPageId, facebookAccessToken, instagramAccountId, instagramAccessToken;

  console.log("Collecting posts for analytics");
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var contentTitle = row[0];
    var facebookChecked = row[3];
    var instagramChecked = row[4];
    var facebookPostId = row[13];
    var instagramPostId = row[16];
    var publishDate = new Date(row[8]);
    var facebookPageId = row[11];
    var facebookAccessToken = refreshFacebookToken();
    var instagramAccountId = row[14];
    var instagramAccessToken = refreshInstagramToken();

    console.log("Facebook Page ID:", facebookPageId);
    console.log("Facebook Access Token:", facebookAccessToken ? "Found (not shown for security)" : "Missing");
    console.log("Instagram Business Account ID:", instagramAccountId);
    console.log("Instagram Access Token:", instagramAccessToken ? "Found (not shown for security)" : "Missing");

    if (facebookChecked && facebookPostId && facebookPageId && facebookAccessToken) {
      facebookPosts.push({
        title: contentTitle, 
        id: facebookPostId, 
        pageId: facebookPageId,
        accessToken: facebookAccessToken,
        publishDate: publishDate
      });
      facebookPages.add(JSON.stringify({id: facebookPageId, token: facebookAccessToken}));
    }

    if (instagramChecked && instagramPostId && instagramAccountId && instagramAccessToken) {
      instagramPosts.push({
        title: contentTitle, 
        id: instagramPostId, 
        accountId: instagramAccountId,
        accessToken: instagramAccessToken,
        publishDate: publishDate
      });
      instagramAccounts.add(JSON.stringify({id: instagramAccountId, token: instagramAccessToken}));
    }
  }

  console.log("Facebook posts to process:", facebookPosts.length);
  console.log("Instagram posts to process:", instagramPosts.length);
  console.log("Unique Facebook pages:", facebookPages.size);
  console.log("Unique Instagram accounts:", instagramAccounts.size);

  // Batch process Facebook posts
  if (facebookPosts.length > 0) {
    var facebookPostAnalytics = batchGetFacebookAnalytics(facebookPosts, facebookAccessToken);
    appendAnalytics(facebookPostSheet, facebookPostAnalytics);
  }

  if (instagramPosts.length > 0) {
    var instagramPostAnalytics = batchGetInstagramAnalytics(instagramPosts, instagramAccessToken);
    appendAnalytics(instagramPostSheet, instagramPostAnalytics);
  }

  if (facebookPages.size > 0) {
    facebookPages.forEach(pageJson => {
      var page = JSON.parse(pageJson);
      console.log("Collecting overall Facebook metrics for page:", page.id);
      var facebookOverallMetrics = getFacebookOverallMetrics(page.id, page.token);
      appendAnalytics(facebookOverallSheet, [facebookOverallMetrics]);
    });
  } else {
    console.log("No Facebook pages to process for overall metrics");
  }

  if (instagramAccounts.size > 0) {
    instagramAccounts.forEach(accountJson => {
      var account = JSON.parse(accountJson);
      console.log("Collecting overall Instagram metrics for account:", account.id);
      var instagramOverallMetrics = getInstagramOverallMetrics(account.id, account.token);
      appendAnalytics(instagramOverallSheet, [instagramOverallMetrics]);
    });
  } else {
    console.log("No Instagram accounts to process for overall metrics");
  }
}

function ensureHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  var lastColumn = sheet.getLastColumn();
  sheet.autoResizeColumns(1, lastColumn);
}

function appendAnalytics(sheet, analyticsData) {
  console.log("Appending analytics data to sheet:", sheet.getName());
  if (analyticsData.length > 0) {
    console.log("Appended", analyticsData.length, "rows of data");
    sheet.getRange(sheet.getLastRow() + 1, 1, analyticsData.length, analyticsData[0].length).setValues(analyticsData);
  }
}

function createAnalyticsTrigger() {
  console.log("Creating analytics trigger");
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'collectAnalytics') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('collectAnalytics')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
}

function batchGetFacebookAnalytics(posts) {
  console.log("Starting batchGetFacebookAnalytics for", posts.length, "posts");
  var analytics = [];

  try {
    var accessToken = refreshFacebookToken();

    var batchRequests = posts.map(post => ({
      method: "GET",
      relative_url: `${post.id}/insights?metric=post_impressions_unique,post_reactions_like_total`
    }));

    var response = UrlFetchApp.fetch(`https://graph.facebook.com/v20.0?include_headers=false&access_token=${accessToken}`, {
      method: 'post',
      payload: {
        batch: JSON.stringify(batchRequests)
      },
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    console.log("Facebook API Response Code:", responseCode);
    console.log("Facebook API Response Body:", responseBody);

    if (responseCode === 200) {
      var results = JSON.parse(responseBody);
      console.log("Full API response:", JSON.stringify(results));

      results.forEach((result, index) => {
        console.log("Processing result", index + 1);
        console.log("Result code:", result.code);
        console.log("Result body:", result.body);
        if (result.code === 200) {
          var data = JSON.parse(result.body).data;
          console.log("Facebook data for post", posts[index].id, ":", JSON.stringify(data));
          if (data && data.length > 0) {
            analytics.push([
              new Date(),
              posts[index].publishDate,
              posts[index].title,
              posts[index].id,
              posts[index].pageId,
              data.find(d => d.name === 'post_impressions_unique')?.values[0]?.value || 0,
              data.find(d => d.name === 'post_reactions_like_total')?.values[0]?.value || 0
            ]);
          } else {
            console.log("No data available for post", posts[index].id);
            analytics.push([
              new Date(),
              posts[index].publishDate,
              posts[index].title,
              posts[index].id,
              posts[index].pageId,
              0,
              0
            ]);
          }
        } else {
          console.log(`Error for post ${posts[index].id}: ${result.body}`);
        }
      });
    } else {
      throw new Error(`Facebook API returned status code ${responseCode}: ${responseBody}`);
    }
  } catch (error) {
    console.error("Error in batchGetFacebookAnalytics:", error);
    return analytics;
  }

  return analytics;
}

function batchGetInstagramAnalytics(posts, accessToken) {
  console.log("Starting batchGetInstagramAnalytics for", posts.length, "posts");
  var analytics = [];
  var batchRequests = posts.map(post => ({
    method: "GET",
    relative_url: `${post.id}/insights?metric=impressions,total_interactions`
  }));

  try {
    var response = UrlFetchApp.fetch(`https://graph.facebook.com/v20.0?include_headers=false&access_token=${accessToken}`, {
      method: 'post',
      payload: {
        batch: JSON.stringify(batchRequests)
      },
      muteHttpExceptions: true
    });

    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    console.log("Instagram API Response Code:", responseCode);
    console.log("Instagram API Response Body:", responseBody);

    if (responseCode === 200) {
      var results = JSON.parse(responseBody);
      console.log("Full API response:", JSON.stringify(results));

      results.forEach((result, index) => {
        console.log("Processing result", index + 1);
        console.log("Result code:", result.code);
        console.log("Result body:", result.body);
        if (result.code === 200) {
          var data = JSON.parse(result.body).data;
          console.log("Instagram data for post", posts[index].id, ":", JSON.stringify(data));
          if (data && data.length > 0) {
            analytics.push([
              new Date(),
              posts[index].publishDate,
              posts[index].title,
              posts[index].id,
              posts[index].accountId,
              data.find(d => d.name === 'impressions')?.values[0]?.value || 0,
              data.find(d => d.name === 'engagement')?.values[0]?.value || 0
            ]);
          } else {
            console.log("No data available for post", posts[index].id);
            analytics.push([
              new Date(),
              posts[index].publishDate,
              posts[index].title,
              posts[index].id,
              posts[index].accountId,
              0,
              0
            ]);
          }
        } else {
          console.log("Error retrieving data for post", posts[index].id);
        }
      });
    } else {
      throw new Error(`Instagram API returned status code ${responseCode}: ${responseBody}`);
    }
  } catch (error) {
    console.error("Error in batchGetInstagramAnalytics:", error);
    return analytics;
  }

  return analytics;
}

function getFacebookOverallMetrics(pageId, accessToken) {
  var pageAccessTokenUrl = `https://graph.facebook.com/v20.0/${pageId}?fields=access_token&access_token=${accessToken}`;
  var pageTokenResponse = UrlFetchApp.fetch(pageAccessTokenUrl, {muteHttpExceptions: true});
  var pageTokenData = JSON.parse(pageTokenResponse.getContentText());
  
  if (!pageTokenData.access_token) {
    console.error("Failed to get Page Access Token:", pageTokenData);
    return [new Date(), pageId, 0, 0, 0, 0, 0, 0];
  }
  
  var pageAccessToken = pageTokenData.access_token;
  
  var url = `https://graph.facebook.com/v20.0/${pageId}/insights?metric=page_impressions_unique,page_total_actions,page_post_engagements,page_fan_adds,page_fan_removes,page_views_total&period=day&access_token=${pageAccessToken}`;
  
  try {
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var data = JSON.parse(response.getContentText());
    console.log("Facebook Overall Metrics API response:", JSON.stringify(data));

    if (data.data && data.data.length > 0) {
      return [
        new Date(),
        pageId,
        data.data.find(d => d.name === 'page_impressions_unique')?.values[0]?.value || 0,
        data.data.find(d => d.name === 'page_total_actions')?.values[0]?.value || 0,
        data.data.find(d => d.name === 'page_post_engagements')?.values[0]?.value || 0,
        data.data.find(d => d.name === 'page_fan_adds')?.values[0]?.value || 0,
        data.data.find(d => d.name === 'page_fan_removes')?.values[0]?.value || 0,
        data.data.find(d => d.name === 'page_views_total')?.values[0]?.value || 0
      ];
    } else {
      console.log("No overall Facebook metrics data available");
      return [new Date(), pageId, 0, 0, 0, 0, 0, 0];
    }
  } catch (error) {
    console.error("Error fetching Facebook overall metrics:", error);
    return [new Date(), pageId, 0, 0, 0, 0, 0, 0];
  }
}

function getInstagramOverallMetrics(igBusinessAccountId, accessToken) {
  var url = `https://graph.facebook.com/v20.0/${igBusinessAccountId}/insights?metric=impressions,reach,accounts_engaged,profile_views&metric_type=total_value&period=day&access_token=${accessToken}`;

  try {
    var response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    var responseCode = response.getResponseCode();
    var responseBody = response.getContentText();
    
    console.log("Instagram API Response Code:", responseCode);
    console.log("Instagram API Response Body:", responseBody);

    if (responseCode === 200) {
      var data = JSON.parse(responseBody);
      
      if (data.data && data.data.length > 0) {
        return [
          new Date(),
          igBusinessAccountId,
          data.data.find(d => d.name === 'impressions')?.total_value?.value || 0,
          data.data.find(d => d.name === 'reach')?.total_value?.value || 0,
          data.data.find(d => d.name === 'accounts_engaged')?.total_value?.value || 0,
          data.data.find(d => d.name === 'profile_views')?.total_value?.value || 0
        ];
      } else {
        console.log("No Instagram overall metrics data available");
        return [new Date(), igBusinessAccountId, 0, 0, 0, 0];
      }
    } else {
      throw new Error(`Instagram API returned status code ${responseCode}: ${responseBody}`);
    }
  } catch (error) {
    console.error("Error fetching Instagram overall metrics:", error);
    return [new Date(), igBusinessAccountId, 0, 0, 0, 0];
  }
}

function refreshFacebookToken() {
  var accessToken = getStoredAccessToken('Facebook');
  if (accessToken) {
    updateTokenInSpreadsheet('Facebook', accessToken);
    return accessToken;
  } else {
    throw new Error('Access token not available. Re-authentication required.');
  }
}

function refreshInstagramToken() {
  return refreshFacebookToken(); 
}


function updateTokenInSpreadsheet(platform, newToken) {
  var spreadsheet = SpreadsheetApp.openByUrl(PropertiesService.getScriptProperties().getProperty("spreadsheetUrl"));
  var sheet = spreadsheet.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  var columnIndex = (platform === 'Facebook') ? 12 : 15; 
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][columnIndex] !== '') {
      sheet.getRange(i + 1, columnIndex + 1).setValue(newToken);
    }
  }
}
