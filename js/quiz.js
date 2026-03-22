/**
 * Quiz Module - Math Question Generation
 * Handles generating random math questions based on difficulty and operations
 */

const Quiz = (function() {
  // Difficulty ranges
  const DIFFICULTY = {
    easy: { min: 1, max: 10 },
    medium: { min: 1, max: 100 },
    hard: { min: 1, max: 1000 }
  };

  // Operation symbols
  const OPERATIONS = {
    addition: { symbol: '+', name: 'Addition' },
    subtraction: { symbol: '-', name: 'Subtraction' },
    multiplication: { symbol: '×', name: 'Multiplication' },
    division: { symbol: '÷', name: 'Division' }
  };

  /**
   * Get a random number between min and max (inclusive)
   */
  function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Shuffle an array (Fisher-Yates algorithm)
   */
  function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Generate an addition question
   */
  function generateAddition(difficulty) {
    const range = DIFFICULTY[difficulty];
    const a = getRandomNumber(range.min, range.max);
    const b = getRandomNumber(range.min, range.max);
    const answer = a + b;
    return {
      question: `${a} + ${b} = ?`,
      answer: answer,
      display: `${a} + ${b}`,
      correctAnswer: answer
    };
  }

  /**
   * Generate a subtraction question
   * Ensure the result is always positive
   */
  function generateSubtraction(difficulty) {
    const range = DIFFICULTY[difficulty];
    let a = getRandomNumber(range.min, range.max);
    let b = getRandomNumber(range.min, range.max);
    
    // Ensure positive result
    if (a < b) {
      [a, b] = [b, a];
    }
    
    const answer = a - b;
    return {
      question: `${a} - ${b} = ?`,
      answer: answer,
      display: `${a} - ${b}`,
      correctAnswer: answer
    };
  }

  /**
   * Generate a multiplication question
   */
  function generateMultiplication(difficulty) {
    let range;
    
    // Use smaller ranges for multiplication to keep numbers manageable
    switch(difficulty) {
      case 'easy':
        range = { min: 1, max: 10 };
        break;
      case 'medium':
        range = { min: 1, max: 12 };
        break;
      case 'hard':
        range = { min: 1, max: 20 };
        break;
      default:
        range = { min: 1, max: 10 };
    }
    
    const a = getRandomNumber(range.min, range.max);
    const b = getRandomNumber(range.min, range.max);
    const answer = a * b;
    return {
      question: `${a} × ${b} = ?`,
      answer: answer,
      display: `${a} × ${b}`,
      correctAnswer: answer
    };
  }

  /**
   * Generate a division question
   * Ensure whole number results
   */
  function generateDivision(difficulty) {
    let range;
    
    switch(difficulty) {
      case 'easy':
        range = { min: 1, max: 10 };
        break;
      case 'medium':
        range = { min: 1, max: 12 };
        break;
      case 'hard':
        range = { min: 1, max: 20 };
        break;
      default:
        range = { min: 1, max: 10 };
    }
    
    // Generate divisor first, then quotient, then calculate dividend
    const b = getRandomNumber(range.min, range.max); // divisor
    const quotient = getRandomNumber(range.min, range.max); // answer
    const a = b * quotient; // dividend
    
    return {
      question: `${a} ÷ ${b} = ?`,
      answer: quotient,
      display: `${a} ÷ ${b}`,
      correctAnswer: quotient
    };
  }

  /**
   * Generate wrong answers that are close to the correct answer
   */
  function generateWrongAnswers(correctAnswer, count) {
    const wrongAnswers = new Set();
    const maxAttempts = 100;
    let attempts = 0;
    
    while (wrongAnswers.size < count && attempts < maxAttempts) {
      attempts++;
      
      // Generate wrong answer within reasonable range of correct answer
      let wrong;
      const offset = getRandomNumber(1, Math.max(5, Math.abs(correctAnswer) * 0.5));
      
      if (Math.random() > 0.5) {
        wrong = correctAnswer + offset;
      } else {
        wrong = correctAnswer - offset;
      }
      
      // Ensure positive and different from correct answer
      if (wrong > 0 && wrong !== correctAnswer && !wrongAnswers.has(wrong)) {
        wrongAnswers.add(wrong);
      }
    }
    
    // If we couldn't generate enough wrong answers, add some fixed ones
    const fixedWrong = [correctAnswer + 1, correctAnswer - 1, correctAnswer + 10, correctAnswer - 10];
    for (const wrong of fixedWrong) {
      if (wrong > 0 && wrong !== correctAnswer && wrongAnswers.size < count) {
        wrongAnswers.add(wrong);
      }
    }
    
    return Array.from(wrongAnswers).slice(0, count);
  }

  /**
   * Generate a complete question with multiple choice answers
   */
  function generateQuestion(playerConfig) {
    // Get selected operations
    const operations = playerConfig.operations || ['addition'];
    
    // Filter out operations not selected
    const availableOperations = Object.keys(OPERATIONS).filter(op => 
      operations.includes(op)
    );
    
    if (availableOperations.length === 0) {
      // Default to addition if none selected
      availableOperations.push('addition');
    }
    
    // Pick random operation
    const operation = availableOperations[Math.floor(Math.random() * availableOperations.length)];
    
    // Get difficulty for this operation
    const difficulty = playerConfig.difficulties?.[operation] || 'easy';
    
    // Generate the question
    let question;
    switch(operation) {
      case 'addition':
        question = generateAddition(difficulty);
        break;
      case 'subtraction':
        question = generateSubtraction(difficulty);
        break;
      case 'multiplication':
        question = generateMultiplication(difficulty);
        break;
      case 'division':
        question = generateDivision(difficulty);
        break;
      default:
        question = generateAddition(difficulty);
    }
    
    // Generate wrong answers
    const wrongAnswers = generateWrongAnswers(question.correctAnswer, 2);
    
    // Combine and shuffle all answers
    const allAnswers = shuffleArray([question.correctAnswer, ...wrongAnswers]);
    
    return {
      question: question.question,
      correctAnswer: question.correctAnswer,
      answers: allAnswers,
      operation: operation,
      difficulty: difficulty
    };
  }

  /**
   * Check if an answer is correct
   */
  function checkAnswer(question, answer) {
    return question.correctAnswer === parseInt(answer);
  }

  // Public API
  return {
    generateQuestion: generateQuestion,
    checkAnswer: checkAnswer,
    OPERATIONS: OPERATIONS,
    DIFFICULTY: DIFFICULTY
  };
})();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Quiz;
}