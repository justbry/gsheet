/**
 * Google Apps Script for 7 Money Milestones Game
 *
 * This script adds a custom menu to Google Sheets for interacting with the game.
 * To install:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this code
 * 4. Save and reload the sheet
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('💰 Money Milestones')
    .addItem('📊 View Status', 'showStatus')
    .addItem('✅ Complete Milestone', 'completeMilestone')
    .addItem('📝 Record Action', 'recordAction')
    .addSeparator()
    .addItem('💡 Get Advice', 'showAdvice')
    .addItem('📈 Progress Report', 'showReport')
    .addToUi();
}

function showStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('GAME_CONFIG');
  const stateSheet = ss.getSheetByName('GAME_STATE');

  if (!configSheet || !stateSheet) {
    SpreadsheetApp.getUi().alert('Game not initialized. Run the CLI init command first.');
    return;
  }

  const playerName = configSheet.getRange('B1').getValue();
  const currentMilestone = configSheet.getRange('B3').getValue();
  const totalScore = configSheet.getRange('B4').getValue();

  const milestones = stateSheet.getRange('A2:E8').getValues();
  let statusMessage = `Player: ${playerName}\n`;
  statusMessage += `Current Milestone: ${currentMilestone}/7\n`;
  statusMessage += `Total Score: ${totalScore} points\n\n`;
  statusMessage += 'Milestones:\n';

  milestones.forEach((row, idx) => {
    const icon = row[1] === 'completed' ? '✅' : row[1] === 'active' ? '🎯' : '🔒';
    statusMessage += `${icon} ${idx + 1}. ${row[0]}\n`;
  });

  SpreadsheetApp.getUi().alert('Game Status', statusMessage, SpreadsheetApp.getUi().ButtonSet.OK);
}

function completeMilestone() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('GAME_CONFIG');
  const stateSheet = ss.getSheetByName('GAME_STATE');

  if (!configSheet || !stateSheet) {
    SpreadsheetApp.getUi().alert('Game not initialized.');
    return;
  }

  const currentMilestone = configSheet.getRange('B3').getValue();

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Complete Milestone',
    `Are you sure you want to complete Milestone ${currentMilestone}?`,
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const scoreMap = [100, 150, 200, 250, 300, 400, 500];
  const score = scoreMap[currentMilestone - 1];

  // Update milestone as completed
  stateSheet.getRange(currentMilestone + 1, 2, 1, 3).setValues([['completed', today, score]]);

  // Activate next milestone
  if (currentMilestone < 7) {
    stateSheet.getRange(currentMilestone + 2, 2).setValue('active');
    configSheet.getRange('B3').setValue(currentMilestone + 1);
  }

  // Update total score
  const currentScore = configSheet.getRange('B4').getValue();
  configSheet.getRange('B4').setValue(currentScore + score);

  ui.alert(`Milestone ${currentMilestone} completed! +${score} points`);
}

function recordAction() {
  const ui = SpreadsheetApp.getUi();
  const actionResponse = ui.prompt(
    'Record Action',
    'What financial action did you take?',
    ui.ButtonSet.OK_CANCEL
  );

  if (actionResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const action = actionResponse.getResponseText();

  const milestoneResponse = ui.prompt(
    'Milestone Number',
    'Which milestone is this for? (1-7)',
    ui.ButtonSet.OK_CANCEL
  );

  if (milestoneResponse.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const milestone = parseInt(milestoneResponse.getResponseText());

  if (isNaN(milestone) || milestone < 1 || milestone > 7) {
    ui.alert('Invalid milestone number. Must be 1-7.');
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const actionsSheet = ss.getSheetByName('PLAYER_ACTIONS');

  if (!actionsSheet) {
    ui.alert('PLAYER_ACTIONS sheet not found.');
    return;
  }

  const timestamp = new Date().toISOString();
  const result = `Recorded for milestone ${milestone}`;

  actionsSheet.appendRow([timestamp, action, milestone, '', result]);

  ui.alert('Action recorded successfully!');
}

function showAdvice() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('GAME_CONFIG');

  if (!configSheet) {
    SpreadsheetApp.getUi().alert('Game not initialized.');
    return;
  }

  const currentMilestone = configSheet.getRange('B3').getValue();

  const advice = {
    1: 'Focus on saving $1000 for your starter emergency fund. Try automating $50/week transfers.',
    2: 'Pay off all credit card debt using the debt snowball method. Attack smallest debt first!',
    3: 'Build 3-6 months of expenses in savings. This is your safety net for major emergencies.',
    4: 'Invest 15% of your gross income for retirement. Use tax-advantaged accounts like 401(k).',
    5: 'Save for college using 529 plans. Even small monthly contributions grow significantly.',
    6: 'Pay off mortgage early with extra principal payments. Saves thousands in interest!',
    7: 'Build wealth and give generously. Diversify investments and create multiple income streams.',
  };

  const message = advice[currentMilestone] || 'Keep making progress!';

  SpreadsheetApp.getUi().alert('Financial Advice', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function showReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName('GAME_CONFIG');
  const stateSheet = ss.getSheetByName('GAME_STATE');

  if (!configSheet || !stateSheet) {
    SpreadsheetApp.getUi().alert('Game not initialized.');
    return;
  }

  const playerName = configSheet.getRange('B1').getValue();
  const currentMilestone = configSheet.getRange('B3').getValue();
  const totalScore = configSheet.getRange('B4').getValue();

  const milestones = stateSheet.getRange('B2:B8').getValues();
  const completedCount = milestones.filter(row => row[0] === 'completed').length;

  let report = `Progress Report\n\n`;
  report += `Player: ${playerName}\n`;
  report += `Current Milestone: ${currentMilestone}/7\n`;
  report += `Completed: ${completedCount}/7\n`;
  report += `Total Score: ${totalScore} points\n\n`;

  if (completedCount >= 1) report += '🎯 First Steps Achieved!\n';
  if (completedCount >= 3) report += '🛡️ Safety Net Established!\n';
  if (completedCount >= 5) report += '📈 Wealth Building Mode!\n';
  if (completedCount === 7) report += '👑 All Milestones Complete!\n';

  SpreadsheetApp.getUi().alert('Progress Report', report, SpreadsheetApp.getUi().ButtonSet.OK);
}
