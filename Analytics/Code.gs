function doGet(request) {
  return HtmlService.createTemplateFromFile('analytics')
      .evaluate();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function getAuthorizationUrl() {
  return Scheduling.getAuthorizationUrl();
}

function handleCallback(request) {
  var callbackResponse = Scheduling.handleCallback(request);
  if (callbackResponse.getContent().includes('Success')) {
    var output = HtmlService.createHtmlOutput('Login successful! You can close this window.');
    output.append('<script>window.opener.postMessage("login_success", "*"); window.close();</script>');
    return output;
  } else {
    return callbackResponse;
  }
}

function isUserLoggedIn() {
  var facebookService = Scheduling.getFacebookService();
  return facebookService.hasAccess();
}

function checkLoginStatus() {
  return { success: isUserLoggedIn() };
}

function getUserInfo() {
  return Scheduling.getUserInfo();
}

function getOverallAnalytics(pageId, platform) {
  try {
    Logger.log("getOverallAnalytics called with pageId: " + pageId + " and platform: " + platform);
    var spreadsheet = Scheduling.getOrCreateAnalyticsSpreadsheet();
    var sheetName = platform === 'Facebook' ? 'Facebook Overall Analytics' : 'Instagram Overall Analytics';
    var sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log("Sheet not found: " + sheetName);
      throw new Error("Analytics sheet not found: " + sheetName);
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var filteredData = data.slice(1).filter(function(row) {
      return row[1].toString() === pageId.toString();
    });
    Logger.log("Filtered data: " + JSON.stringify(filteredData));

    if (filteredData.length > 0) {
      var result = filteredData.map(function(row) {
        var metrics = [];
        if (platform === 'Facebook') {
          metrics = [
            ['Metric', 'Value'],
            ['Page Impressions', row[2]],
            ['Page Total Actions', row[3]],
            ['Page Post Engagements', row[4]],
            ['Page Fans Add', row[5]],
            ['Page Fans Remove', row[6]],
            ['Page Views', row[7]]
          ];
        } else { // Instagram
          metrics = [
            ['Metric', 'Value'],
            ['Impressions', row[2]],
            ['Reach', row[3]],
            ['Accounts Engaged', row[4]],
            ['Profile Views', row[5]]
          ];
        }
        return {
          date: row[0],
          pageId: row[1],
          metrics: metrics
        };
      });

      Logger.log("Returning result: " + JSON.stringify(result));
      return JSON.stringify(result);
      
    } else {
      Logger.log("No data found for pageId: " + pageId);
      return JSON.stringify({ error: "No data found for the selected page" });
    }
  } catch (error) {
    Logger.log("Error in getOverallAnalytics: " + error.message);
    return JSON.stringify({ error: "An error occurred: " + error.message });
  }
}

function getContentAnalytics(pageId, platform) {
  Logger.log("getContentAnalytics called with pageId: " + pageId + " and platform: " + platform);
  var spreadsheet = Scheduling.getOrCreateAnalyticsSpreadsheet();
  var sheetName = platform === 'Facebook' ? 'Facebook Post Analytics' : 'Instagram Post Analytics';
  var sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    Logger.log("Sheet not found: " + sheetName);
    return JSON.stringify({ error: "Analytics sheet not found: " + sheetName });
  }

  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var filteredData = data.slice(1).filter(function(row) {
    return row[4].toString() === pageId.toString();
  });

  if (filteredData.length > 0) {
    return JSON.stringify(filteredData.map(function(row) {
      return {
        date: row[0],
        publishDate: row[1],
        title: row[2],
        postId: row[3],
        pageId: row[4],
        impressions: row[5],
        reactions: platform === 'Facebook' ? row[6] : null,
        engagement: platform === 'Instagram' ? row[6] : null
      };
    }));
  } else {
    Logger.log("No content data found for pageId: " + pageId);
    return JSON.stringify({ error: "No data found for the selected page" });
  }
}

function testGetOverallAnalytics() {
  var result = getOverallAnalytics('17841468290413002', 'Instagram');
  Logger.log(result);
}

function testGetContentAnalytics() {
  var result = getContentAnalytics('YOUR_PAGE_ID', 'Facebook');
  Logger.log(result);
}