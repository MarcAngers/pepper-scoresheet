// This is the script running on the google app for this project
// It is copied here for git history only, it does not serve any funtion here.

// --- HTML SERVING ---
function doGet() {
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Pepper Scorekeeper')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// --- PLAYER MANAGEMENT ---
function getPlayersFromSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('players');
  if (!sheet) {
    sheet = ss.insertSheet('players');
    sheet.appendRow(['Player Names']);
  }
  const data = sheet.getDataRange().getValues();
  return data.slice(1).flat().filter(String);
}

function addNewPlayerToSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('players');
  if (!sheet) {
    sheet = ss.insertSheet('players');
    sheet.appendRow(['Player Names']);
  }
  sheet.appendRow([name]);
  return true;
}

// --- DATA PROCESSING ENGINE ---

function saveGameData(jsonString) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gameData = JSON.parse(jsonString);
  
  // 1. ARCHIVE: Save Raw Data to GameHistory
  updateGameHistory(ss, gameData, jsonString);
  
  // 2. STATS: Update Master Player Stats
  updateMasterStats(ss, gameData);
  
  // 3. RELATIONSHIPS: Update Partner/Opponent Stats
  updateRelationships(ss, gameData);
  
  return "Game Saved & Stats Updated!";
}

// --- SUB-FUNCTIONS ---

function updateGameHistory(ss, data, rawJson) {
  let sheet = ss.getSheetByName('GameHistory');
  if (!sheet) {
    sheet = ss.insertSheet('GameHistory');
    sheet.appendRow(['Date', 'Winner', 'Red Score', 'Black Score', 'JSON Data']);
  }
  sheet.appendRow([
    data.date, 
    data.winner, 
    data.finalScore.red, 
    data.finalScore.black, 
    rawJson
  ]);
}

function updateMasterStats(ss, data) {
  let sheet = ss.getSheetByName('MasterStats');
  
  // Define Headers
  const headers = [
    "Player Name", "Games Played", "Wins", "Losses", "Win %", "Total Point +/-",
    "Bids Taken", "Bids Made", "Bids Scuppled", "Success %", "Risk Tolerance (0-100)",
    "Pepper Bids", "Pepper Success", "Ladies Bids", "Perfect Hands", "Favorite Suit",
    // Hidden tracking columns (Col 17+)
    "Total Risk Score", "Spades", "Hearts", "Diamonds", "Clubs", "No Trump", "Ladies Count"
  ];

  if (!sheet) {
    sheet = ss.insertSheet('MasterStats');
    sheet.appendRow(headers);
    // Add Formulas for Win % (Col 5 / E) and Success % (Col 10 / J)
    // We apply array formulas to the top row usually, but simple row logic for now
  }

  // Get existing data
  const range = sheet.getDataRange();
  let values = range.getValues(); // 2D array
  
  // Helper to find row index by player name
  const findRow = (name) => {
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === name) return i;
    }
    return -1;
  };

  // Identify all players in this game
  const allPlayers = [...data.teams.red, ...data.teams.black];
  const winningTeam = data.winner === 'Red' ? data.teams.red : data.teams.black;
  const redDiff = data.finalScore.red - data.finalScore.black;
  
  // Process each player
  allPlayers.forEach(player => {
    let rowIndex = findRow(player);
    let row;
    
    if (rowIndex === -1) {
      // Create new row initialized with 0s
      row = [player, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, "", 0, 0, 0, 0, 0, 0, 0];
      values.push(row);
      rowIndex = values.length - 1;
    } else {
      row = values[rowIndex];
    }
    
    // --- BASIC STATS ---
    row[1]++; // Games Played
    if (winningTeam.includes(player)) {
      row[2]++; // Wins
    } else {
      row[3]++; // Losses
    }
    // Win % (Col 4 - index 4) will be formula or calculated here
    row[4] = (row[2] / row[1]); // Simple calc for now
    
    // Point +/-
    if (data.teams.red.includes(player)) {
      row[5] += redDiff;
    } else {
      row[5] -= redDiff; // Black team gets negative of red diff
    }

    // --- BIDDING STATS ---
    // We need to loop through the game history to find bids by THIS player
    data.history.forEach(round => {
      if (round.bidder === player) {
        row[6]++; // Bids Taken
        
        // Result
        if (round.result === 'made') {
          row[7]++; // Bids Made
        } else {
          row[8]++; // Scuppled
        }

        // Pepper/Ladies Tracking
        const val = round.bid; // "Small Pepper", "Big Pepper", "8", etc.
        const suit = round.suit;

        // Pepper (Small or Big)
        if (val === "Small Pepper" || val === "Big Pepper") {
          row[11]++; // Pepper Bids
          if (round.result === 'made') row[12]++;
        }

        // Ladies (Bid 8 + Suit Ladies)
        if (val === "8" && suit === "Ladies") {
          row[13]++;
        }

        // Perfect Hands (Made + 8 Tricks)
        if (round.result === 'made' && round.tricks === 8) {
          row[14]++;
        }

        // --- RISK CALCULATION ---
        let risk = 0;
        if (val === "3" || val === "4") risk = 10;
        else if (val === "5") risk = 25;
        else if (val === "6") risk = 50;
        else if (val === "7") risk = 75;
        else if (val === "8") risk = 85;
        else if (val === "Small Pepper") risk = 90;
        else if (val === "Big Pepper") risk = 100;
        // Ladies bonus risk
        if (suit === "Ladies") risk = 100;
        
        row[16] += risk; // Hidden Total Risk Score

        // --- SUIT TRACKING ---
        if (suit === "Spades") row[17]++;
        if (suit === "Hearts") row[18]++;
        if (suit === "Diamonds") row[19]++;
        if (suit === "Clubs") row[20]++;
        if (suit === "No Trump") row[21]++;
        if (suit === "Ladies") row[22]++;
      }
    });

    // --- RE-CALCULATE DERIVED STATS ---
    
    // Success %
    if (row[6] > 0) row[9] = row[7] / row[6];
    
    // Risk Tolerance (Total Risk / Bids Taken)
    if (row[6] > 0) row[10] = Math.round(row[16] / row[6]);
    
    // Favorite Suit (Find max of cols 17-22)
    const suits = {
      "Spades": row[17], "Hearts": row[18], "Diamonds": row[19], 
      "Clubs": row[20], "NT": row[21], "Ladies": row[22]
    };
    row[15] = Object.keys(suits).reduce((a, b) => suits[a] > suits[b] ? a : b);

  });

  // Write back to sheet
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function updateRelationships(ss, data) {
  let sheet = ss.getSheetByName('Relationships');
  if (!sheet) {
    sheet = ss.insertSheet('Relationships');
    sheet.appendRow(["Player 1", "Player 2", "Games Together", "Wins Together", "Games Against", "P1 Wins vs P2"]);
  }
  
  const range = sheet.getDataRange();
  let values = range.getValues();
  
  // Helper to find pair row
  const findPairRow = (p1, p2) => {
    // Sort names alphabetically to ensure consistency
    const sorted = [p1, p2].sort();
    const nameA = sorted[0];
    const nameB = sorted[1];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === nameA && values[i][1] === nameB) return i;
    }
    
    // Not found, create new
    values.push([nameA, nameB, 0, 0, 0, 0]);
    return values.length - 1;
  };
  
  // 1. Process Partners (Red Team)
  processPartners(data.teams.red, data.winner === 'Red', findPairRow, values);
  // 1. Process Partners (Black Team)
  processPartners(data.teams.black, data.winner === 'Black', findPairRow, values);
  
  // 2. Process Opponents (Red vs Black)
  processOpponents(data.teams.red, data.teams.black, data.winner === 'Red', findPairRow, values);
  
  // Write back
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function processPartners(team, didWin, findRowFn, values) {
  // If team has 2 or more players, generate pairs
  for (let i = 0; i < team.length; i++) {
    for (let j = i + 1; j < team.length; j++) {
      const rowIndex = findRowFn(team[i], team[j]);
      values[rowIndex][2]++; // Games Together
      if (didWin) values[rowIndex][3]++; // Wins Together
    }
  }
}

function processOpponents(teamA, teamB, teamA_Won, findRowFn, values) {
  // Every player in Team A vs Every player in Team B
  teamA.forEach(p1 => {
    teamB.forEach(p2 => {
      const rowIndex = findRowFn(p1, p2);
      values[rowIndex][4]++; // Games Against
      
      // Determine if P1 (from sorted pair) won
      // We need to know which one in the sorted pair corresponds to the winner
      const sorted = [p1, p2].sort();
      const p1_is_sorted_first = (sorted[0] === p1);
      
      // If p1 won (teamA won), and p1 is the first name in col A, increment Col F
      // If p2 won (teamB won), and p2 is the first name in col A, increment Col F
      
      // Actually simpler: Col F is "P1 Wins vs P2". P1 is strictly the alphabetical first.
      // So if alphabetical first person was on the winning team, increment.
      
      const alphaFirst = sorted[0];
      const winningTeam = teamA_Won ? teamA : teamB;
      
      if (winningTeam.includes(alphaFirst)) {
        values[rowIndex][5]++;
      }
    });
  });
}