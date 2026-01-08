<h3>🌶️ Pepper Scorekeeper & Analytics Engine 🌶️</h3>

A mobile-responsive web application designed to track bids and scores, manage dealer rotation, and generate analytics for the Pepper card game.

This application runs on a Google Apps Script, using a Google Sheet as a database to store game history, calculate player statistics, and track partner chemistry.

<h3>✨ Features ✨</h3>
<h5>📱 The Web App</h5>
Mobile-First Design, built with Bootstrap 5.

Live Scoreboard: Sticky header updates in real-time as rounds are entered.

Dynamic Score Tracking: All fields are editable always, and any changes made dynamically update the scoreboard.

Dealer Tracking: Smart dealer selector that enforces game rules (alternating teams) and auto-fills rotation patterns.

Auto-Save: Uses LocalStorage to save game state after every interaction. If the page reloads or crashes, the game resumes exactly where you left off.

Visual Feedback: Dynamic visual cues for "Successful" vs. "Scuppled" bids and team-specific borders.

<h5>📊 The Analytics Backend</h5>
Master Stats: Tracks Wins, Losses, Win %, Bids Made/Scuppled, and a normalized "Risk Tolerance" score.

Deep Dives: Tracks specific feats like "Perfect Hands" (8 tricks), "Pepper" bids, and favorite suits.

Relationship Tracking: Calculates "Best Partner" (highest win % together) and "Arch Nemesis" (lowest win % against).

Player Profiles: A dashboard tab in Google Sheets to view individual player cards.

<h5>🛠️ Tech Stack</h5>
Frontend: HTML5, CSS3, Bootstrap 5, jQuery.

Backend: Google Apps Script (JavaScript).

Database: Google Sheets.

Hosting: Google Web App (Serverless).

<h3>🎮 How to Play/Use 🎮</h3>
Start: Select 4 (or 6) players. The app automatically splits them into Red and Black teams.

Log Rounds:

(Optional) Select the Dealer.

Select the Bid (3 through Big Pepper).

Select the Suit.

Select the Player who decided the bid.

Scoring:

Select Made (Check) or Scuppled (X).

Select the number of tricks taken.

Points are awarded/deducted

Finish: Once a team crosses 50 points and has "Agency" (made the bid or scuppled the enemy), the Upload button appears.

Upload: Clicking upload sends the data to Google Sheet, updates the leaderboard, and clears the local save.

<h3>🚀 Installation & Setup 🚀</h3>
<b>Google Sheet Setup</b>
Create a new Google Sheet.

Rename the first tab to players (optional, the script will generate necessary tabs automatically).

<b>Google Apps Script</b>
In the Google Sheet, go to Extensions > Apps Script.

Code.gs: Delete existing code and paste the backend logic (server-side script).

index.html: Create a new HTML file named index.html and paste ALL the frontend code. On the Google Apps Script side, the HTML, CSS, and JS all need to be contained within this one file.

<b>Deploy</b>
Click Deploy > New Deployment.

Select type: Web App.

Set Execute as: Me.

Set Who has access: Anyone.

Click Deploy and authorize the script permissions.

Copy the Web App URL.

<b>(Optional) Custom Redirect</b>
To make the URL easier to share, you can host a simple index.html on Amazon S3 or GitHub Pages that redirects to the Google Script URL.

<h3>📂 Data Structure 📂</h3>
The application automatically manages the following sheets:

GameHistory: The raw archive. Contains the date, winner, score, and a full JSON blob of every move made in the game.

MasterStats: The leaderboard. One row per player containing cumulative stats.

Relationships: A lookup table tracking every unique pair of players (Partners and Opponents).

Player Profile: (User Created) A dashboard using VLOOKUP and LET formulas to display data from the other tabs.
