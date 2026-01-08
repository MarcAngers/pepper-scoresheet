const STORAGE_KEY = 'pepper_game_v1';
      let allPlayers = [];
      let teamLeft = []; // Red
      let teamRight = []; // Black
      let editingSide = ''; 
      let rowCount = 0;
      let gameLocked = false;
      let savedGameData = null; // Holds parsed local storage
      
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
          // Starting a NEW game means we should clear old storage
          localStorage.removeItem(STORAGE_KEY);
          lockConfig();
          addGameRow();
          saveState(); // Initialize save
        });

        $('#btn-unlock-config').click(unlockConfig);

        // CHECK FOR SAVED GAME
        checkForSavedGame();
      });

      function updateDateDisplay() {
        const dateVal = new Date($('#game-date').val());
        $('#current-date-display').text(dateVal.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      }

      // --- LOCAL STORAGE LOGIC ---
      function checkForSavedGame() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            try {
                savedGameData = JSON.parse(raw);
                if (savedGameData && savedGameData.rows && savedGameData.rows.length > 0) {
                    $('#resume-date').text(savedGameData.date || 'Unknown Date');
                    new bootstrap.Modal('#resumeModal').show();
                }
            } catch (e) {
                console.error("Save file corrupt", e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
      }

      function resumeSavedGame() {
        bootstrap.Modal.getInstance('#resumeModal').hide();
        
        if (!savedGameData) return;

        // Restore Teams & Config
        $('#game-date').val(savedGameData.date);
        updateDateDisplay();
        teamLeft = savedGameData.teams.red;
        teamRight = savedGameData.teams.black;
        
        $('#display-names-left').text(teamLeft.join(', '));
        $('#label-team-left').text(teamLeft.length > 0 ? teamLeft.join('/') : 'Red');
        $('#display-names-right').text(teamRight.join(', '));
        $('#label-team-right').text(teamRight.length > 0 ? teamRight.join('/') : 'Black');
        
        lockConfig();

        // Restore Rows
        savedGameData.rows.forEach(r => {
            // Add row to DOM
            addGameRow(); // Adds empty row and increments rowCount
            
            // Get the ID of the just-added row
            const rowId = `row-${rowCount}`;
            const row = $(`#${rowId}`);
            
            // Populate Fields
            row.find('.bid-val').val(r.bidVal);
            row.find('.bid-suit').val(r.bidSuit);
            row.find('.bid-player').val(r.bidPlayer);
            row.find('.dealer-select').val(r.dealer); // Restore dealer selection
            
            // Update Visuals based on loaded values
            updateRowVisuals(rowId);
            
            // If row was finished, set result and lock
            if (r.resType) {
                currentRowId = rowId;
                currentScoringType = r.resType;
                finalizeScore(r.resTricks);
            }
        });
        
        // Final recalc to ensure all texts/badges are correct
        recalcDealers(); // Re-run dealer text/dropdown logic
        updateAllScores();
      }

      function clearSaveAndReset() {
        localStorage.removeItem(STORAGE_KEY);
        bootstrap.Modal.getInstance('#resumeModal').hide();
      }

      function saveState() {
        // Build the state object
        const rows = [];
        $('.game-row').each(function() {
            const row = $(this);
            rows.push({
                bidVal: row.find('.bid-val').val(),
                bidSuit: row.find('.bid-suit').val(),
                bidPlayer: row.find('.bid-player').val(),
                dealer: row.find('.dealer-select').val(), // Save raw val even if hidden
                resTricks: row.find('.res-tricks').val(),
                resType: row.find('.res-type').val()
            });
        });

        const state = {
            date: $('#game-date').val(),
            teams: { red: teamLeft, black: teamRight },
            rows: rows
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
        localStorage.removeItem(STORAGE_KEY); // Clear save if resetting
        location.reload();
      }

      // --- ROW LOGIC ---
      function addGameRow() {
        const lastRow = $('.game-row').last();
        if (lastRow.length > 0 && !lastRow.hasClass('row-locked')) {
            return;
        }

        rowCount++;
        const rowId = `row-${rowCount}`;
        const bidderOptions = [...teamLeft, ...teamRight].map(n => `<option value="${n}">${n}</option>`).join('');
        
        const html = `
          <div class="game-row" id="${rowId}" onclick="editRow('${rowId}')">
            <span class="bid-indicator-badge badge-red d-none">Red Team Bid</span>
            <span class="bid-indicator-badge badge-black d-none">Black Team Bid</span>
            
            <div class="dealer-badge">
                <span>D:</span>
                <select class="dealer-select" onchange="recalcDealers(); saveState();">
                   </select>
                <span class="dealer-text d-none"></span>
            </div>

            <div class="row g-2 align-items-center text-center">
              <div class="col-4">
                <label class="small text-muted d-block">Bid</label>
                <select class="form-select form-select-sm bid-val" onchange="updateRowVisuals('${rowId}'); saveState();">
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
                <select class="form-select form-select-sm bid-suit" onchange="updateRowVisuals('${rowId}'); saveState();">
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
                <select class="form-select form-select-sm bid-player" onchange="updateRowVisuals('${rowId}'); saveState();">
                  <option value="" selected disabled>-</option>
                  ${bidderOptions}
                </select>
                <div class="locked-text bid-player-text d-none"></div>
              </div>
            </div>

            <div class="row mt-2 g-2 d-none" id="${rowId}-actions">
              <div class="col-6">
                <button class="btn btn-success btn-action-lg w-100" onclick="handleResult(event, '${rowId}', 'made')">
                  <i class="fas fa-check me-1"></i> Made
                </button>
              </div>
              <div class="col-6">
                <button class="btn btn-danger btn-action-lg w-100" onclick="handleResult(event, '${rowId}', 'set')">
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

            <input type="hidden" class="res-tricks" value="">
            <input type="hidden" class="res-type" value="">
          </div>
        `;
        
        $('#game-rows-container').append(html);
        
        recalcDealers();
        saveState(); // Save after adding new row
        
        document.getElementById(rowId).scrollIntoView({behavior: "smooth", block: "center"});
      }
      
      // --- DEALER LOGIC ---
      function recalcDealers() {
        const rows = $('.game-row');
        const totalPlayers = teamLeft.length + teamRight.length;
        const is6Player = (totalPlayers === 6);
        
        let redOrder = [];
        let blackOrder = [];
        
        const lockInCount = is6Player ? 4 : 2; 
        
        rows.each(function(index) {
             const row = $(this);
             const select = row.find('.dealer-select');
             const textSpan = row.find('.dealer-text');
             const currentVal = select.val();
             
             if (index < lockInCount) {
                let allowedPlayers = [];
                let forcedTeam = null; 

                if (index === 0) {
                    allowedPlayers = [...teamLeft, ...teamRight];
                    if (currentVal) {
                        if (teamLeft.includes(currentVal)) redOrder.push(currentVal);
                        else blackOrder.push(currentVal);
                    }
                } else {
                    const prevRow = rows.eq(index-1);
                    const prevDealer = prevRow.find('.dealer-select').val() || prevRow.find('.dealer-text').text();
                    
                    if (prevDealer) {
                        const prevIsRed = teamLeft.includes(prevDealer);
                        forcedTeam = prevIsRed ? 'black' : 'red';
                        
                        const teamRoster = (forcedTeam === 'red') ? teamLeft : teamRight;
                        const alreadyOrdered = (forcedTeam === 'red') ? redOrder : blackOrder;
                        
                        allowedPlayers = teamRoster.filter(p => !alreadyOrdered.includes(p));
                    } else {
                         allowedPlayers = [];
                    }
                    
                    if (currentVal && allowedPlayers.includes(currentVal)) {
                        if (forcedTeam === 'red') redOrder.push(currentVal);
                        else blackOrder.push(currentVal);
                    } else if (currentVal && !allowedPlayers.includes(currentVal)) {
                        select.val(''); 
                    }
                }

                select.removeClass('d-none');
                textSpan.addClass('d-none');
                
                const savedVal = select.val();
                select.empty();
                select.append('<option value="" disabled selected>?</option>');
                
                allowedPlayers.forEach(p => {
                    select.append(`<option value="${p}">${p}</option>`);
                });
                
                if (savedVal && allowedPlayers.includes(savedVal)) {
                    select.val(savedVal);
                }

             } else {
                if (redOrder.length < teamLeft.length) {
                    const remaining = teamLeft.filter(p => !redOrder.includes(p));
                    redOrder = [...redOrder, ...remaining]; 
                }
                if (blackOrder.length < teamRight.length) {
                    const remaining = teamRight.filter(p => !blackOrder.includes(p));
                    blackOrder = [...blackOrder, ...remaining];
                }

                const firstDealer = rows.eq(0).find('.dealer-select').val();
                if (!firstDealer) return; 
                
                const firstIsRed = teamLeft.includes(firstDealer);
                const isRedTurn = (index % 2 === 0) ? firstIsRed : !firstIsRed;
                const teamIndex = Math.floor(index / 2) % (totalPlayers / 2);
                const autoDealer = isRedTurn ? redOrder[teamIndex] : blackOrder[teamIndex];
                
                select.addClass('d-none');
                textSpan.removeClass('d-none').text(autoDealer);
                // Invisibly set value so saveState captures auto-dealers too (optional, but good for restoring)
                select.val(autoDealer); 
             }
        });
      }

      function editRow(rowId) {
        const row = $(`#${rowId}`);
        if (!row.hasClass('row-locked')) return;

        row.removeClass('row-locked row-result-made row-result-scuppled');
        
        row.find('.bid-val').removeClass('d-none');
        row.find('.bid-val-text').addClass('d-none');
        
        row.find('.bid-suit').removeClass('d-none');
        row.find('.bid-suit-text').addClass('d-none');
        
        row.find('.bid-player').removeClass('d-none');
        row.find('.bid-player-text').addClass('d-none');
        
        $(`#${rowId}-actions`).removeClass('d-none');
        
        row.find('.res-type').val(''); 
        updateAllScores();
        saveState(); // Save state (row unlocked) 
      }

      function updateRowVisuals(rowId) {
        const row = $(`#${rowId}`);
        const bidVal = row.find('.bid-val').val();
        const suitSelect = row.find('.bid-suit');
        const suitVal = suitSelect.val();
        const player = row.find('.bid-player').val();
        
        let allowNT = false;
        let allowLadies = false;
        
        if (["6", "7", "8", "Small Pepper", "Big Pepper"].includes(bidVal)) allowNT = true;
        if (["8", "Small Pepper", "Big Pepper"].includes(bidVal)) allowLadies = true;
        
        const optNT = suitSelect.find('option[value="No Trump"]');
        const optLadies = suitSelect.find('option[value="Ladies"]');
        
        optNT.prop('hidden', !allowNT);
        optLadies.prop('hidden', !allowLadies);
        
        if (suitVal === "No Trump" && !allowNT) suitSelect.val("");
        if (suitVal === "Ladies" && !allowLadies) suitSelect.val("");

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

      function handleResult(event, rowId, type) {
        event.stopPropagation();
        currentRowId = rowId;
        currentScoringType = type;
        const bidVal = $(`#${rowId} .bid-val`).val();

        if (type === 'made' && (bidVal === "Small Pepper" || bidVal === "Big Pepper")) {
           finalizeScore(8);
           return;
        }

        let bidNum = parseInt(bidVal);
        if (bidVal === "Small Pepper" || bidVal === "Big Pepper") bidNum = 8;

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
        
        row.find('.res-tricks').val(tricksTaken);
        row.find('.res-type').val(currentScoringType);

        row.addClass('row-locked');
        if(currentScoringType === 'made') {
            row.addClass('row-result-made');
        } else {
            row.addClass('row-result-scuppled');
        }
        $(`#${currentRowId}-actions`).addClass('d-none');
        
        const bidVal = row.find('.bid-val').val();
        const suitText = row.find('.bid-suit option:selected').text();
        const player = row.find('.bid-player').val();

        row.find('.bid-val').addClass('d-none');
        row.find('.bid-val-text').html(bidVal).removeClass('d-none');
        
        row.find('.bid-suit').addClass('d-none');
        row.find('.bid-suit-text').html(suitText).removeClass('d-none');
        
        row.find('.bid-player').addClass('d-none');
        row.find('.bid-player-text').html(player).removeClass('d-none');

        updateAllScores();
        saveState(); // Save state (row finalized)
      }

      function updateAllScores() {
        let redTotal = 0;
        let blackTotal = 0;
        let gameIsOver = false;

        $('.game-row').each(function() {
            const row = $(this);
            const rowId = row.attr('id');
            
            const resType = row.find('.res-type').val();
            if (!resType) {
                $(`#${rowId}-history`).addClass('d-none');
                return;
            }

            const tricks = parseInt(row.find('.res-tricks').val());
            const bidVal = row.find('.bid-val').val();
            const suitVal = row.find('.bid-suit').val();
            const player = row.find('.bid-player').val();
            const isTeamLeft = teamLeft.includes(player);

            let leftPoints = 0;
            let rightPoints = 0;
            
            const isLadiesBid = (bidVal === "8" && suitVal === "Ladies");

            if (resType === 'made') {
              if (bidVal === "Small Pepper") {
                isTeamLeft ? leftPoints = 12 : rightPoints = 12;
              } else if (bidVal === "Big Pepper") {
                isTeamLeft ? leftPoints = 24 : rightPoints = 24;
              } else if (isLadiesBid) {
                isTeamLeft ? leftPoints = 10 : rightPoints = 10;
              } else {
                const pointsForBidder = tricks;
                const pointsForOpponent = 8 - tricks;
                if(isTeamLeft) { leftPoints = pointsForBidder; rightPoints = pointsForOpponent; }
                else { rightPoints = pointsForBidder; leftPoints = pointsForOpponent; }
              }
            } else { // Scuppled
              let penalty = 0;
              if (bidVal === "Small Pepper") penalty = 12;
              else if (bidVal === "Big Pepper") penalty = 24;
              else if (isLadiesBid) penalty = 10;
              else penalty = parseInt(bidVal);
              
              if(isTeamLeft) leftPoints = -penalty; else rightPoints = -penalty;
              
              const pointsForOpponent = 8 - tricks;
              if(isTeamLeft) rightPoints = pointsForOpponent; else leftPoints = pointsForOpponent;
            }

            redTotal += leftPoints;
            blackTotal += rightPoints;

            $(`#${rowId}-hist-left`).text(redTotal);
            $(`#${rowId}-hist-right`).text(blackTotal);
            $(`#${rowId}-history`).removeClass('d-none');
        });

        $('#score-left').text(redTotal);
        $('#score-right').text(blackTotal);

        $('#score-left').removeClass('winner-circle');
        $('#score-right').removeClass('winner-circle');
        $('#finish-game-area').addClass('d-none');

        if (redTotal >= 50 || blackTotal >= 50) {
            gameIsOver = true;
            if (redTotal >= 50 && redTotal > blackTotal) $('#score-left').addClass('winner-circle');
            else if (blackTotal >= 50) $('#score-right').addClass('winner-circle');
            
            $('#finish-game-area').removeClass('d-none');
        } else {
             addGameRow();
        }
      }

      function uploadGameData() {
        gameHistory = [];
        $('.game-row').each(function() {
            const row = $(this);
            const resType = row.find('.res-type').val();
            if (!resType) return;

            const rowCount = row.attr('id').replace('row-','');
            const player = row.find('.bid-player').val();
            const bidVal = row.find('.bid-val').val();
            const suitVal = row.find('.bid-suit').val();
            const tricks = parseInt(row.find('.res-tricks').val());
            const redScore = parseInt(row.find(`#row-${rowCount}-hist-left`).text());
            const blackScore = parseInt(row.find(`#row-${rowCount}-hist-right`).text());

            gameHistory.push({
              round: parseInt(rowCount),
              bidder: player,
              bid: bidVal,
              suit: suitVal,
              result: resType, 
              tricks: tricks,
              runningScore: { red: redScore, black: blackScore }
            });
        });

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
          // Clear save on success
          localStorage.removeItem(STORAGE_KEY);
        }).saveGameData(JSON.stringify(finalData));
      }