"use strict";
// Check to make sure global namespace for PokerBot (PB) is not already being used
// Set an empty object if it's not
if (!window.PB) {
	window.PB = {};
}
window.PB.Core = function () {
	// -------------------------------------------------------------
	// PRIVATE VARS
	// -------------------------------------------------------------
	const debug = false;
	let gameState = setupInitializeGameState();
	// -------------------------------------------------------------
	// PRIVATE ANALYSIS (CARD AND HAND) FUNCTIONS
	// -------------------------------------------------------------
	function analysisEffectiveStackSize() {
		const myPosition = 0;
		let myStackSize = gameState.players[myPosition].stackSize;
		let effectiveStackSize = myStackSize;

		for (let i = 0; i < gameState.players.length; i++) {
			if (i === myPosition) continue;

			let otherStackSize = gameState.players[i].stackSize;

			if (otherStackSize < effectiveStackSize) {
				effectiveStackSize = otherStackSize;
			}
		}
		return effectiveStackSize;
	}
	function analysisGetHandStrength(cards) {
		const [high, low] = cards.sort((a, b) => analysisGetHandStrengthCardValue(b) - analysisGetHandStrengthCardValue(a));
		const highValue = analysisGetHandStrengthCardValue(high);
		const lowValue = analysisGetHandStrengthCardValue(low);
		let score = highValue;
		// Pair
		if (highValue === lowValue) {
			score *= 2;
		}
		// Suited
		else if (analysisGetHandStrengthCardSuit(high) === analysisGetHandStrengthCardSuit(low)) {
			score += 2;
		}
		// Gap penalty
		const gap = highValue - lowValue - 1;
		if (gap < 1) {
			score -= 0;
		} else if (gap < 3) {
			score -= 1;
		} else if (gap < 5) {
			score -= 2;
		} else {
			score -= 4;
		}
		// Straight penalty applied to hands that are one card away from completing a straight
		if (highValue < 12 && lowValue > 2 && gap === 4) {
			score -= 1;
		}
		return score;
	}
	function analysisGetHandStrengthCardValue(card) {
		const value = card.slice(0, -1);
		const values = {
			T: 10,
			J: 11,
			Q: 12,
			K: 13,
			A: 14,
		};
		return values[value] || parseInt(value);
	}
	function analysisGetHandStrengthCardSuit(card) {
		return card.slice(-1);
	}
	function analysisUpdatePositionStats(correctlyPlayed) {
		let totalHandsPlayed = 0;
		for (const position in gameState.zoneTotals) {
			let zoneTotals = gameState.zoneTotals[position];
			let zonePlayed = gameState.zonePlayed[position];
			let percentage = (isNaN(zonePlayed / zoneTotals * 100)) ? 0 : zonePlayed / zoneTotals * 100;
			document.querySelector('.stat-' + position).textContent = percentage.toFixed(0) + '%';
			document.querySelector('.stat-totals-' + position).textContent = zoneTotals;
			totalHandsPlayed += zoneTotals;
		}
		document.querySelector('.stat-total-hands-played').textContent = totalHandsPlayed;
		// Update correctlyPlayedHands
		if (correctlyPlayed) {
			gameState.correctlyPlayedHands++;
		}
		let correctPercentage = (isNaN(gameState.correctlyPlayedHands / totalHandsPlayed * 100)) ? 0 : gameState.correctlyPlayedHands / totalHandsPlayed * 100;
		document.querySelector('.stat-correctly-played-hands').textContent = correctPercentage.toFixed(0);
	}
	// -------------------------------------------------------------
	// PRIVATE PRE-FLOP DECISION MAKING FUNCTIONS
	// -------------------------------------------------------------
	function preFlopAction(action) {
		if (debug) { console.log("My Action: ", action); }
		const zone = setupGetPositionZone(0, gameState.buttonPosition, gameState.players.length);
		const hand = preFlophandToAnnotation(gameState.players[0].hand);
		const optimalCall = preFlopGetOptimalHandRanges()[zone]['call'].includes(hand);
		if (debug) { console.log("Is Optimal Call: ", optimalCall); }
		const optimalRaise = preFlopGetOptimalHandRanges()[zone]['raise'].includes(hand);
		if (debug) { console.log("Is Optimal Raise: ", optimalRaise); }
		// Bump total hands
		gameState.zoneTotals[zone] += 1;
		// Bump position played count for this zone if call or raise
		if (action === 'call' || action === 'raise') {
			gameState.zonePlayed[zone] += 1;
		}
		let correctlyPlayed = false;
		// Check if action matches optimal play
		const feedbackSpan = document.querySelector('.feedback');
		if (action === 'fold' && !optimalCall && !optimalRaise) {
			feedbackSpan.textContent = 'Correct move!';
			correctlyPlayed = true;
		} else if ((action === 'call' && optimalCall) || (action === 'raise' && optimalRaise)) {
			feedbackSpan.textContent = 'Correct move!';
			correctlyPlayed = true;
		} else if (action === 'fold' && optimalCall) {
			feedbackSpan.textContent = 'Incorrect - Folded when you should have called';
		} else if (action === 'fold' && optimalRaise) {
			feedbackSpan.textContent = 'Incorrect - Folded when you should have raised';
		} else if (action === 'call' && !optimalCall) {
			feedbackSpan.textContent = 'Incorrect - Called when you should have folded';
		} else if (action === 'call' && optimalRaise) {
			feedbackSpan.textContent = 'Incorrect - Called when you should have raised';
		} else if (action === 'raise' && !optimalRaise) {
			feedbackSpan.textContent = 'Incorrect - Raised when you should have folded';
		} else if (action === 'raise' && optimalCall) {
			feedbackSpan.textContent = 'Incorrect - Raised when you should have called';
		}
		// Update stats
		analysisUpdatePositionStats(correctlyPlayed);
		// Enable #show-flop and #next-hand buttons
		document.querySelector('#show-flop').disabled = false;
		document.querySelector('#next-hand').disabled = false;
	}
	function preFlopAllHandRanges() {
		return [
			'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
			'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
			'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s',
			'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'Q3s', 'Q2s',
			'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'J4s', 'J3s', 'J2s',
			'T9s', 'T8s', 'T7s', 'T6s', 'T5s', 'T4s', 'T3s', 'T2s',
			'98s', '97s', '96s', '95s', '94s', '93s', '92s',
			'87s', '86s', '85s', '84s', '83s', '82s',
			'76s', '75s', '74s', '73s', '72s',
			'65s', '64s', '63s', '62s',
			'54s', '53s', '52s',
			'43s', '42s',
			'32s',
			'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o',
			'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o', 'K4o', 'K3o', 'K2o',
			'QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o',
			'JTo', 'J9o', 'J8o', 'J7o', 'J6o', 'J5o', 'J4o', 'J3o', 'J2o',
			'T9o', 'T8o', 'T7o', 'T6o', 'T5o', 'T4o', 'T3o', 'T2o',
			'98o', '97o', '96o', '95o', '94o', '93o', '92o',
			'87o', '86o', '85o', '84o', '83o', '82o',
			'76o', '75o', '74o', '73o', '72o',
			'65o', '64o', '63o', '62o',
			'54o', '53o', '52o',
			'43o', '42o',
			'32o'
		];
	}
	function preFlopArrayPlayersActingBeforeMe() {
		const players = gameState.players;
		const buttonPosition = gameState.buttonPosition;
		const actingBeforeMe = [];
		// Determine the small blind and big blind positions.
		const smallBlindPosition = (buttonPosition + 1) % players.length;
		const bigBlindPosition = (buttonPosition + 2) % players.length;
		// Calculate the position of the first player to act after the big blind.
		const firstToActPosition = (bigBlindPosition + 1) % players.length;
		// Add players who act before player[0] to the actingBeforeMe array.
		for (let i = firstToActPosition; i !== 0; i = (i + 1) % players.length) {
			actingBeforeMe.push(players[i]);
		}
		return actingBeforeMe;
	}
	function preFlopDecision(playerId) {
		let action = "fold";
		if (debug) { console.log("preflopDecision ---------------------------------------"); }
		// Determine the position type of the current player
		gameState.players[playerId].positionZone = setupGetPositionZone(playerId, gameState.buttonPosition, gameState.players.length);
		if (debug) { console.log("Position Zone: ", gameState.players[playerId].positionZone); }
		// Get the player's hand range based on their hole cards
		let playerHandRange = preFlopGetPlayerHandRange(gameState.players[playerId]);
		if (debug) { console.log("Player Hand Range: ", playerHandRange); }
		// Calculate the expected value of the current player's decision
		let handStrength = analysisGetHandStrength(gameState.players[playerId].hand);
		if (debug) { console.log("Hand Strength: ", handStrength); }
		// Convert hand to range format
		const handRangeFormat = preFlophandToAnnotation(gameState.players[playerId].hand);
		if (debug) { console.log("Range Format: ", handRangeFormat); }
		// If the expected value is positive and the player's hand is in the 'raise' or 'reraise' range...
		if (playerHandRange['raise'] && playerHandRange['raise'].includes(handRangeFormat) || playerHandRange['reraise'] && playerHandRange['reraise'].includes(handRangeFormat)) {
			action = 'raise';
		} else if (playerHandRange['call'] && playerHandRange['call'].includes(handRangeFormat)) {
			action = 'call';
		}
		document.querySelector('.player-' + playerId + ' .action strong').textContent = action;
		if (action === 'fold') {
			document.querySelector('.player-' + playerId + ' .action').classList.add('fold');
		}
	}
	function preFlopGetLooseHandRanges() {
		const handRanges = {
			"early": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'AKo', 'AQo'],
				call: ['QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s', '65s', '54s', '43s', 'A9o', 'A8o', 'A7o', 'A6o', 'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo']
			},
			"cutoff": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'AKo', 'AQo'],
				call: ['88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'JTs', 'J9s', 'J8s', 'J7s', 'T9s', 'T8s', 'T7s', '98s', '97s', '96s', '87s', '86s', '76s', '75s', '65s', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'QJo', 'QTo', 'Q9o', 'Q8o', 'JTo', 'J9o', 'J8o', 'T9o', 'T8o', '98o', '97o', '87o']
			},
			"button": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'K3s', 'K2s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'Q6s', 'Q5s', 'Q4s', 'JTs', 'J9s', 'J8s', 'J7s', 'J6s', 'J5s', 'T9s', 'T8s', 'T7s', 'T6s', '98s', '97s', '96s', '95s', '87s', '86s', '85s', '76s', '75s', '74s', '65s', '64s', '63s', '54s', '53s', 'AKo', 'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'K6o', 'K5o', 'QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o', 'JTo', 'J9o', 'J8o', 'J7o', 'T9o', 'T8o', 'T7o'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s', 'AKo', 'AQo', 'AJo', 'ATo'],
				call: ['88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s', 'K4s', 'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s', 'JTs', 'J9s', 'J8s', 'J7s', 'T9s', 'T8s', 'T7s', '98s', '97s', '96s', '87s', '86s', '76s', '75s', '65s', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o', 'A6o', 'KQo', 'KJo', 'KTo', 'K9o', 'K8o', 'K7o', 'QJo', 'QTo', 'Q9o', 'Q8o', 'JTo', 'J9o', 'J8o', 'T9o', 'T8o', '98o', '97o', '87o']
			},
			"blinds": {
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'A5s', 'AKo', 'AQo'],
				call: ['QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'JTs', 'T9s', '98s', '87s', '76s', '65s', '54s', '43s', 'A9o', 'A8o', 'A7o', 'A6o', 'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo']
			}
		};
		return handRanges;
	}
	function preFlopGetOptimalHandRanges() {
		// Adheres to Ed Millers recommendations for optimal hand ranges
		const handRanges = {
			"early": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'],
				call: []
			},
			"cutoff": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QTs', 'Q9s', 'JTs', 'T9s', '98s', '87s', '76s', '65s'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: []
			},
			"button": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'QJs', 'QTs', 'Q9s', 'JTs', 'T9s', '98s', '87s', '76s', '65s'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: ['66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'K8s', 'K7s', 'Q9s', 'J9s', 'T8s', '97s', '86s', '75s', '64s', '53s', '43s']
			},
			"blinds": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'AKo', 'AQo', 'AJo', 'ATo', 'KQo'],
				call: ['88', '77', '66', '55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'K8s', 'K7s', 'Q9s', 'J9s', 'T9s', '98s', '87s', '76s', '65s', '54s']
			}
		};
		return handRanges;
	}
	function preFlopGetPlayerHandRange(player) {
		let handRange;
		let positionZone = player.positionZone;
		switch (player.type) {
			case 'optimal':
				handRange = preFlopGetOptimalHandRanges()[positionZone];
				break;
			case 'loose':
				handRange = preFlopGetLooseHandRanges()[positionZone];
				break;
			case 'tight':
				handRange = preFlopGetTightHandRanges()[positionZone];
				break;
			default:
				console.error('Invalid player type:', player.type);
				break;
		}
		return handRange;
	}
	function preFlopGetTightHandRanges() {
		const handRanges = {
			"early": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AKo', 'AQo'],
				reraise: ['AA', 'KK', 'QQ', 'AKs', 'AKo'],
				call: ['JJ', 'TT', '99', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs']
			},
			"cutoff": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'AKo', 'AQo', 'AJo'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo', 'AQo'],
				call: ['88', '77', '66', 'A9s', 'A8s', 'A7s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs']
			},
			"button": {
				raise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'AKo', 'AQo', 'AJo', 'ATo'],
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', 'AKs', 'AQs', 'AKo', 'AQo'],
				call: ['77', '66', '55', 'A8s', 'A7s', 'A6s', 'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s']
			},
			"blinds": {
				reraise: ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AKo', 'AQo'],
				call: ['TT', '99', '88', '77', '66', '55', '44', '33', '22', 'AJs', 'ATs', 'A9s', 'A8s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs']
			}
		};
		return handRanges;
	}
	function preFlophandToAnnotation(hand) {
		const suits = { 'c': 'clubs', 'd': 'diamonds', 'h': 'hearts', 's': 'spades' };
		const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

		const card1 = { value: hand[0][0], suit: hand[0][1] };
		const card2 = { value: hand[1][0], suit: hand[1][1] };

		// Sort the cards in descending order by value
		const sortedCards = [card1, card2].sort((a, b) => values[b.value] - values[a.value]);

		// Determine the hand type
		const handType = (sortedCards[0].suit === sortedCards[1].suit) ? 's' : 'o';

		// If the cards have the same value, it's a pocket pair
		if (sortedCards[0].value === sortedCards[1].value) {
			return `${sortedCards[0].value}${sortedCards[1].value}`;
		} else {
			return `${sortedCards[0].value}${sortedCards[1].value}${handType}`;
		}
	}
	function preFlopPlayerActionsBeforeMe() {
		// Get an array of players who act before me.
		const playersActingBeforeMe = preFlopArrayPlayersActingBeforeMe();
		if (debug) { console.log("Players Acting Before Me: ", playersActingBeforeMe); }
		// Store actions taken by players acting before me.
		const actionsAudit = [];
		// Loop through and determine the actions of the players acting before me.
		for (let i = 0; i < playersActingBeforeMe.length; i++) {
			const playerId = playersActingBeforeMe[i].id;
			const action = preFlopDecision(playerId);
			// Save to the actionsAudit array.
			actionsAudit.push({
				playerId: playerId,
				action: action
			});
			// Add to the gameState object.
			gameState.players[playerId].action = action;
		}
		if (debug) { console.log("Preflop Actions Audit: ", actionsAudit); }
	}
	function preFlopStats() {
		// Effective stack size
		document.querySelector('.stat-ess').textContent = analysisEffectiveStackSize();
	}
	// -------------------------------------------------------------
	// PRIVATE SETUP FUNCTIONS
	// -------------------------------------------------------------
	function setupCreateDeck() {
		// Create a deck of 52 cards
		const suits = ['c', 'd', 'h', 's'];
		const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
		const deck = [];
		for (const suit of suits) {
			for (const rank of ranks) {
				deck.push(rank + suit);
			}
		}
		return deck;
	}
	function setupCreatePlayers(numPlayers) {
		// Validate that we have 5-10 players
		if (numPlayers < 5 || numPlayers > 10) {
			alert('Invalid number of players');
			return false;
		}
		if (debug) { console.log("Number of Players: ", numPlayers); }
		// Create an array of players
		const primaryPlayer = document.querySelector('.player-primary');
		const players = [];
		let html = '';
		for (let i = 0; i < numPlayers; i++) {
			const playerId = i;
			const playerType = (i === 0) ? 'optimal' : setupGetPlayerType();
			const stackSize = Math.floor(Math.random() * (250 - 50 + 1) + 50);
			players.push({
				id: playerId,
				type: playerType,
				stackSize: stackSize,
				hand: []
			});
			// Not applicable to primary player
			if (i === 0) {
				// Add players to DOM
				primaryPlayer.innerHTML = _tmpl('playerZero', {
					stackSize: stackSize
				});
			} else {
				// Add players to DOM
				html += _tmpl('player', {
					playerId: playerId,
					stackSize: stackSize
				});
			}
		}
		// Insert html after .player-primary
		primaryPlayer.insertAdjacentHTML('afterend', html);
		// Return the array of players
		return players;
	}
	function setupDealCards() {
		// Make a copy of the shuffled deck
		let deck = gameState.deck;
		// Burn the first card
		deck.shift();
		// Deal the first card to each player, then second card to each player
		for (let i = 0; i < 2; i++) {
			for (let i = 0; i < gameState.players.length; i++) {
				gameState.players[i].hand.push(deck.shift());
			}
		}
		// Populate primary players cards src property
		document.getElementById('card1').src = 'img/' + gameState.players[0].hand[0] + '.png';
		document.getElementById('card2').src = 'img/' + gameState.players[0].hand[1] + '.png';
	}
	function setupGetButtonPosition() {
		// If the button position is not set, set it to a random position
		if (gameState.buttonPosition === undefined) {
			// Randomly assign the button position
			return gameState.buttonPosition = Math.floor(Math.random() * gameState.players.length);
		}
		// Otherwise, increment the button position
		return gameState.buttonPosition = (gameState.buttonPosition + 1) % gameState.players.length;
	}
	function setupGetPosition() {
		return (gameState.players.length + 1) % gameState.players.length;
	}
	function setupGetPositionZone(playerIndex, buttonIndex, totalPlayers) {
		const positionAwayFromButton = (playerIndex - buttonIndex + totalPlayers) % totalPlayers;
		const cutoff = Math.floor(totalPlayers * 0.9);

		if (positionAwayFromButton === 0) {
			return 'button';
		} else if (positionAwayFromButton === cutoff) {
			return 'cutoff';
		} else if (positionAwayFromButton === 1 || positionAwayFromButton === 2) {
			return 'blinds';
		} else {
			return 'early';
		}
	}
	function setupGetPlayerType() {
		const playerTypes = ["loose", "tight", "optimal"];
		return playerTypes[Math.floor(Math.random() * playerTypes.length)];
	}
	function setupInit(askForPlayers) {
		// Generate players
		gameState.players = (askForPlayers) ? setupCreatePlayers(prompt('Enter the number of players (5-10):')) : setupCreatePlayers(10);
		if (debug) { console.log("Players Created: ", gameState.players); }
		// If player count is off, don't continue
		if (!gameState.players) {
			return;
		}
		// Generate deck
		gameState.deck = setupCreateDeck();
		if (debug) { console.log("Deck Created: ", gameState.deck); }
		// Shuffle deck
		setupShuffleDeck();
		if (debug) { console.log("Deck Shuffled: ", gameState.deck); }
		// Deal cards
		setupDealCards();
		if (debug) { console.log("Cards Dealt: ", gameState.players); }
		// Get starting button position
		gameState.buttonPosition = setupGetButtonPosition();
		if (debug) { console.log("Button Position: ", gameState.buttonPosition); }
		// Add the button
		document.querySelector('.player-' + gameState.buttonPosition).classList.add('button');
		// Determine which players act before me and simulate their actions
		preFlopPlayerActionsBeforeMe();
		// Events
		setupRegisterEvents();
		// Show preflop stats
		preFlopStats();
	}
	function setupInitializeGameState() {
		return {
			deck: [],
			flop: [],
			players: [],
			correctlyPlayedHands: 0,
			zonePlayed: {
				early: 0,
				cutoff: 0,
				button: 0,
				blinds: 0
			},
			zoneTotals: {
				early: 0,
				cutoff: 0,
				button: 0,
				blinds: 0
			}
		};
	}
	function setupRegisterEvents() {
		// Call button
		document.getElementById('call').addEventListener('click', function () {
			preFlopAction('call');
		}, { once: true });
		// Fold button
		document.getElementById('fold').addEventListener('click', function () {
			preFlopAction('fold');
		}, { once: true });
		// Next hand button
		document.getElementById('next-hand').addEventListener('click', function () {
			const askForPlayers = false;
			return setupResetGame(askForPlayers);
		});
		// Raise button
		document.getElementById('raise').addEventListener('click', function () {
			preFlopAction('raise');
		}, { once: true });
		// Reset button
		document.getElementById('reset').addEventListener('click', function () {
			const askForPlayers = true;
			setupResetGame(askForPlayers);
		}, { once: true });
		// Show flop button
		document.getElementById('show-flop').addEventListener('click', function () {
			// Burn the next card
			gameState.deck.shift();
			// Deal the next 3 cards
			for (let i = 0; i < 3; i++) {
				gameState.flop.push(gameState.deck.shift());
			}
			// Update the flop cards
			document.querySelector('.street-card-1').src = 'img/' + gameState.flop[0] + '.png';
			document.querySelector('.street-card-2').src = 'img/' + gameState.flop[1] + '.png';
			document.querySelector('.street-card-3').src = 'img/' + gameState.flop[2] + '.png';
		});
		// Show hands button
		document.getElementById('show').addEventListener('click', function () {
			for (let i = 0; i < gameState.players.length; i++) {
				if (i === 0) {
					continue;
				}
				// Show first card
				document.querySelector('.player-' + i + ' .card1').src = 'img/' + gameState.players[i].hand[0] + '.png';
				// Show second card
				document.querySelector('.player-' + i + ' .card2').src = 'img/' + gameState.players[i].hand[1] + '.png';
			}
		}, { once: true });
	}
	function setupResetGame(askForPlayers) {
		if (debug) { console.log('-----'); console.log('RESET'); console.log('-----'); }
		// Remove button position
		gameState.buttonPosition = undefined;
		document.querySelector('.player.button').classList.remove('button');
		// Show all players
		document.querySelectorAll('.player-other').forEach(function (player) {
			player.remove();
		});
		// Clear feedback
		document.querySelector('.feedback').innerHTML = '';
		// Hide flop cards
		document.querySelectorAll('.street-card').forEach(function (card) {
			card.removeAttribute('src');
		});
		// Disable #show-flop and #next-hand buttons
		document.querySelector('#show-flop').disabled = true;
		document.querySelector('#next-hand').disabled = true;
		// Reset players & deck
		gameState.players = [];
		gameState.deck = [];
		gameState.flop = [];
		setupInit();
	}
	function setupShuffleDeck() {
		for (let i = gameState.deck.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[gameState.deck[i], gameState.deck[j]] = [gameState.deck[j], gameState.deck[i]];
		}
	}
	// -------------------------------------------------------------
	// PRIVATE UTILITY FUNCTIONS
	// -------------------------------------------------------------
	// John Resig - http://ejohn.org/blog/javascript-micro-templating/ - MIT Licensed
	function _tmpl(str, data) { let tmplCache = []; let fn = !/\W/.test(str) ? tmplCache[str] = tmplCache[str] || _tmpl(document.getElementById(str).innerHTML) : new Function("obj", "let p=[],print=function(){p.push.apply(p,arguments);};" + "with(obj){p.push('" + str.replace(/[\r\t\n]/g, " ").split("<%").join("\t").replace(/((^|%>)[^\t]*)'/g, "$1\r").replace(/\t=(.*?)%>/g, "',$1,'").split("\t").join("');").split("%>").join("p.push('").split("\r").join("\\'") + "');}return p.join('');"); return data ? fn( data ) : fn; }
	// -------------------------------------------------------------
	// PUBLIC FACING METHODS
	// -------------------------------------------------------------
	return {
		init: function () {
			if (document.hidden) {
				window.addEventListener('focus', function () {
					return setupInit();
				}, false);
			} else {
				if (document.readyState === 'complete') {
					setupInit();
				} else {
					window.addEventListener('load', setupInit, false);
				}
			}
		}
	};
} ();

PB.Core.init();