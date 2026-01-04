let allPlayers = [];
      let teamLeft = []; // Red
      let teamRight = []; // Black
      let editingSide = ''; 
      let rowCount = 0;
      let gameLocked = false;
      let gameHistory = []; 
      let gameOver = false;
      
      let currentRowId = null;
      let currentScoringType = ''; 
      
      $(document).ready(function() {
        document.getElementById('game-date').valueAsDate = new Date();
        updateDateDisplay();
        
        google.script.run.withSuccessHandler(function(players) {
          allPlayers = players;
        }).getPlayersFromSheet();

        $('#game-date').on('change', updateDateDisplay);
        
        $('#btn-start-game').click(function() {
          if(!validateTeams()) return;
          lockConfig();
          addGameRow();
        });

        $('#btn-unlock-config').click(unlockConfig);
      });

      function updateDateDisplay() {
        const dateVal = new Date($('#game-date').val());
        $('#current-date-display').text(dateVal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }

      // --- PLAYER & CONFIG LOGIC ---
      function openPlayerModal(side) {
        if(gameLocked) return;
        editingSide = side;
        const currentSelection = (side === 'left') ? teamLeft : teamRight;
        const otherSelection = (side === 'left') ? teamRight : teamLeft;
        const list = $('#player-checkbox-list').empty();
        
        allPlayers.forEach(p => {
          if(otherSelection.includes(p)) return;
          const isChecked = currentSelection.includes(p) ? 'checked' : '';
          list.append(`
            <label class="list-group-item">
              <input class="form-check-input me-1" type="checkbox" value="${p}" ${isChecked}>
              ${p}
            </label>
          `);
        });
        new bootstrap.Modal('#playerModal').show();
      }

      function addNewPlayer() {
        const name = $('#new-player-name').val().trim();
        if(name && !allPlayers.includes(name)) {
          allPlayers.push(name);
          google.script.run.addNewPlayerToSheet(name); 
          $('#player-checkbox-list').prepend(`
            <label class="list-group-item">
              <input class="form-check-input me-1" type="checkbox" value="${name}" checked>
              ${name}
            </label>
          `);
          $('#new-player-name').val('');
        }
      }

      function savePlayerSelection() {
        const selected = [];
        $('#player-checkbox-list input:checked').each(function() { selected.push($(this).val()); });
        if (editingSide === 'left') {
          teamLeft = selected;
          $('#display-names-left').text(teamLeft.join(', ') || 'Select...');
          $('#label-team-left').text(teamLeft.length > 0 ? teamLeft.join('/') : 'Red');
        } else {
          teamRight = selected;
          $('#display-names-right').text(teamRight.join(', ') || 'Select...');
          $('#label-team-right').text(teamRight.length > 0 ? teamRight.join('/') : 'Black');
        }
        bootstrap.Modal.getInstance('#playerModal').hide();
        validateTeams();
      }

      function validateTeams() {
        const l = teamLeft.length; const r = teamRight.length;
        const valid = (l >= 2 && l <= 3 && r >= 2 && r <= 3 && l === r);
        $('#btn-start-game').prop('disabled', !valid);
        return valid;
      }

      function lockConfig() {
        gameLocked = true;
        $('#config-panel').addClass('locked-config');
        $('#btn-unlock-config').removeClass('d-none');
      }

      function unlockConfig() {
        if(rowCount > 0 && !confirm("Reset game?")) return;
        location.reload();
      }

      // --- ROW LOGIC ---
      function addGameRow() {
        if(gameOver) return;
        rowCount++;
        const rowId = `row-${rowCount}`;
        const bidderOptions = [...teamLeft, ...teamRight].map(n => `<option value="${n}">${n}</option>`).join('');
        
        const html = `
          <div class="game-row" id="${rowId}">
            <span class="bid-indicator-badge badge-red d-none">Red Team Bid</span>
            <span class="bid-indicator-badge badge-black d-none">Black Team Bid</span>

            <div class="row g-2 align-items-center text-center">
              <div class="col-4">
                <label class="small text-muted d-block">Bid</label>
                <select class="form-select form-select-sm bid-val" onchange="updateRowVisuals('${rowId}')">
                  <option value="" selected disabled>-</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="Small Pepper">Sm Pep</option>
                  <option value="Big Pepper">Big Pep</option>
                </select>
                <div class="locked-text bid-val-text d-none"></div>
              </div>
              <div class="col-4">
                <label class="small text-muted d-block">Suit</label>
                <select class="form-select form-select-sm bid-suit" onchange="updateRowVisuals('${rowId}')">
                  <option value="" selected disabled>-</option>
                  <option value="Spades">&#9824; Spades</option>
                  <option value="Hearts">&#9829; Hearts</option>
                  <option value="Diamonds">&#9830; Diamonds</option>
                  <option value="Clubs">&#9827; Clubs</option>
                  <option value="No Trump" hidden>No Trump</option>
                  <option value="Ladies" hidden>Ladies</option>
                </select>
                <div class="locked-text bid-suit-text d-none"></div>
              </div>
              <div class="col-4">
                <label class="small text-muted d-block">Player</label>
                <select class="form-select form-select-sm bid-player" onchange="updateRowVisuals('${rowId}')">
                  <option value="" selected disabled>-</option>
                  ${bidderOptions}
                </select>
                <div class="locked-text bid-player-text d-none"></div>
              </div>
            </div>

            <div class="row mt-2 g-2 d-none" id="${rowId}-actions">
              <div class="col-6">
                <button class="btn btn-success btn-action-lg w-100" onclick="handleResult('${rowId}', 'made')">
                  <i class="fas fa-check me-1"></i> Made
                </button>
              </div>
              <div class="col-6">
                <button class="btn btn-danger btn-action-lg w-100" onclick="handleResult('${rowId}', 'set')">
                  <i class="fas fa-times me-1"></i> Scuppled
                </button>
              </div>
            </div>
            
            <div class="mt-2 text-center d-none" id="${rowId}-history">
              <div class="running-score-badge">
                 <span class="text-team-red" id="${rowId}-hist-left">0</span>
                 <span class="mx-2 text-muted">vs</span>
                 <span class="text-team-black" id="${rowId}-hist-right">0</span>
              </div>
            </div>
          </div>
        `;
        
        $('#game-rows-container').append(html);
        document.getElementById(rowId).scrollIntoView({behavior: "smooth", block: "center"});
      }

      function updateRowVisuals(rowId) {
        const row = $(`#${rowId}`);
        const bidVal = row.find('.bid-val').val();
        const suitSelect = row.find('.bid-suit');
        const suitVal = suitSelect.val();
        const player = row.find('.bid-player').val();
        
        let allowNT = false;
        let allowLadies = false;
        
        // NT for 6+
        if (["6", "7", "8", "Small Pepper", "Big Pepper"].includes(bidVal)) allowNT = true;
        // Ladies for 8 (and Peppers for display)
        if (["8", "Small Pepper", "Big Pepper"].includes(bidVal)) allowLadies = true;
        
        const optNT = suitSelect.find('option[value="No Trump"]');
        const optLadies = suitSelect.find('option[value="Ladies"]');
        
        optNT.prop('hidden', !allowNT);
        optLadies.prop('hidden', !allowLadies);
        
        if (suitVal === "No Trump" && !allowNT) suitSelect.val("");
        if (suitVal === "Ladies" && !allowLadies) suitSelect.val("");

        // Reset borders
        row.removeClass('row-border-red row-border-black');
        row.find('.bid-indicator-badge').addClass('d-none');
        
        if (player) {
          const isTeamLeft = teamLeft.includes(player);
          if (isTeamLeft) {
            row.addClass('row-border-red');
            row.find('.bid-indicator-badge.badge-red').removeClass('d-none');
          } else {
            row.addClass('row-border-black');
            row.find('.bid-indicator-badge.badge-black').removeClass('d-none');
          }
        }

        if (bidVal && suitSelect.val() && player) {
          $(`#${rowId}-actions`).removeClass('d-none');
        } else {
          $(`#${rowId}-actions`).addClass('d-none');
        }
      }

      function handleResult(rowId, type) {
        currentRowId = rowId;
        currentScoringType = type;
        const bidVal = $(`#${rowId} .bid-val`).val();

        // Pepper Bids logic (Made)
        if (type === 'made' && (bidVal === "Small Pepper" || bidVal === "Big Pepper")) {
           finalizeScore(8);
           return;
        }

        let bidNum = parseInt(bidVal);
        if (bidVal === "Small Pepper" || bidVal === "Big Pepper") {
          bidNum = 8;
        }

        $('#scoring-instruction-text').text(`Tricks Taken (Bid was ${bidVal})`);
        
        const container = $('#trick-selector-container').empty();
        
        const start = (type === 'made') ? bidNum : 0;
        const end = (type === 'made') ? 8 : (bidNum - 1);

        for (let i = start; i <= end; i++) {
          container.append(`
            <button class="btn btn-outline-dark btn-lg" style="width: 50px; height: 50px;" onclick="finalizeScore(${i})">${i}</button>
          `);
        }
        new bootstrap.Modal('#scoringModal').show();
      }

      function finalizeScore(tricksTaken) {
        const modalEl = document.getElementById('scoringModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        const row = $(`#${currentRowId}`);
        const bidVal = row.find('.bid-val').val();
        const suit = row.find('.bid-suit').text(); 
        const suitVal = row.find('.bid-suit').val();
        const player = row.find('.bid-player').val();
        const isTeamLeft = teamLeft.includes(player);
        
        let leftPoints = 0;
        let rightPoints = 0;
        
        // --- LADIES BID LOGIC (Bid 8 + Suit Ladies) ---
        const isLadiesBid = (bidVal === "8" && suitVal === "Ladies");

        if (currentScoringType === 'made') {
          if (bidVal === "Small Pepper") {
            isTeamLeft ? leftPoints = 12 : rightPoints = 12;
          } else if (bidVal === "Big Pepper") {
            isTeamLeft ? leftPoints = 24 : rightPoints = 24;
          } else if (isLadiesBid) {
            // Ladies Made: +10 Points
            isTeamLeft ? leftPoints = 10 : rightPoints = 10;
          } else {
            // Standard: +Tricks
            const pointsForBidder = tricksTaken;
            const pointsForOpponent = 8 - tricksTaken;
            if(isTeamLeft) { leftPoints = pointsForBidder; rightPoints = pointsForOpponent; }
            else { rightPoints = pointsForBidder; leftPoints = pointsForOpponent; }
          }
        } else { // Scuppled
          let penalty = 0;
          if (bidVal === "Small Pepper") penalty = 12;
          else if (bidVal === "Big Pepper") penalty = 24;
          else if (isLadiesBid) penalty = 10; // Ladies Scuppled: -10 Points
          else penalty = parseInt(bidVal); // Standard: -Bid
          
          // Apply Penalty
          if(isTeamLeft) leftPoints = -penalty; else rightPoints = -penalty;
          
          // Opponent Points
          const pointsForOpponent = 8 - tricksTaken;
          if(isTeamLeft) rightPoints = pointsForOpponent; else leftPoints = pointsForOpponent;
        }
        
        const newLeft = parseInt($('#score-left').text()) + leftPoints;
        const newRight = parseInt($('#score-right').text()) + rightPoints;
        $('#score-left').text(newLeft);
        $('#score-right').text(newRight);
        
        // --- LOCK ROW & APPLY NEW VISUALS ---
        row.addClass('row-locked');
        if(currentScoringType === 'made') {
            row.addClass('row-result-made');
        } else {
            row.addClass('row-result-scuppled');
        }
        $(`#${currentRowId}-actions`).addClass('d-none');
        
        const suitText = row.find('.bid-suit option:selected').text();
        
        row.find('.bid-val').addClass('d-none');
        // Removed the iconHTML from here since it's now in the background
        row.find('.bid-val-text').html(bidVal).removeClass('d-none');
        
        row.find('.bid-suit').addClass('d-none');
        row.find('.bid-suit-text').html(suitText).removeClass('d-none');
        
        row.find('.bid-player').addClass('d-none');
        row.find('.bid-player-text').html(player).removeClass('d-none');

        $(`#${currentRowId}-hist-left`).text(newLeft);
        $(`#${currentRowId}-hist-right`).text(newRight);
        $(`#${currentRowId}-history`).removeClass('d-none');
        
        gameHistory.push({
          round: rowCount,
          bidder: player,
          bid: bidVal,
          suit: suitVal,
          result: currentScoringType, 
          tricks: tricksTaken,
          pointsDelta: { red: leftPoints, black: rightPoints },
          runningScore: { red: newLeft, black: newRight }
        });

        const redHasAgency = (isTeamLeft && currentScoringType === 'made') || (!isTeamLeft && currentScoringType === 'set');
        const blackHasAgency = (!isTeamLeft && currentScoringType === 'made') || (isTeamLeft && currentScoringType === 'set');

        if (newLeft >= 50 && redHasAgency) {
          triggerWin('left');
        } else if (newRight >= 50 && blackHasAgency) {
          triggerWin('right');
        } else {
          addGameRow();
        }
      }

      function triggerWin(side) {
        gameOver = true;
        if(side === 'left') $('#score-left').addClass('winner-circle');
        else $('#score-right').addClass('winner-circle');
        $('#finish-game-area').removeClass('d-none');
      }

      function uploadGameData() {
        const btn = $('#btn-upload');
        btn.prop('disabled', true).text('Uploading...');
        const finalData = {
          date: $('#game-date').val(),
          teams: { red: teamLeft, black: teamRight },
          winner: $('#score-left').hasClass('winner-circle') ? 'Red' : 'Black',
          finalScore: { red: parseInt($('#score-left').text()), black: parseInt($('#score-right').text()) },
          history: gameHistory
        };
        google.script.run.withSuccessHandler(function(res) {
          alert(res);
          btn.text('Uploaded!');
        }).saveGameData(JSON.stringify(finalData));
      }