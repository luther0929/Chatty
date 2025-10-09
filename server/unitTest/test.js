const assert = require('assert');
const { validatePassword } = require('../server');

describe('Password Validation Unit Tests', () => {
  
  describe('Test Case #1 - Valid Strong Password', () => {
    it('should return valid:true for a strong password', () => {
      const result = validatePassword('Password123!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #2 - Password Too Short', () => {
    it('should return valid:false for password less than 8 characters', () => {
      const result = validatePassword('Pass1!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must be at least 8 characters long');
    });
  });

  describe('Test Case #3 - Missing Uppercase Letter', () => {
    it('should return valid:false when missing uppercase letter', () => {
      const result = validatePassword('password123!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain both uppercase and lowercase letters');
    });
  });

  describe('Test Case #4 - Missing Lowercase Letter', () => {
    it('should return valid:false when missing lowercase letter', () => {
      const result = validatePassword('PASSWORD123!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain both uppercase and lowercase letters');
    });
  });

  describe('Test Case #5 - Missing Number', () => {
    it('should return valid:false when missing number', () => {
      const result = validatePassword('Password!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain at least one number');
    });
  });

  describe('Test Case #6 - Missing Special Character', () => {
    it('should return valid:false when missing special character', () => {
      const result = validatePassword('Password123');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain at least one special character');
    });
  });

  describe('Test Case #7 - All Requirements Met', () => {
    it('should return valid:true with uppercase, lowercase, number, and special char', () => {
      const result = validatePassword('MyPass123!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #8 - Complex Valid Password', () => {
    it('should return valid:true for complex password', () => {
      const result = validatePassword('Str0ng!P@ssw0rd');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #9 - Empty Password', () => {
    it('should return valid:false for empty password', () => {
      const result = validatePassword('');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must be at least 8 characters long');
    });
  });

  describe('Test Case #10 - Exactly 8 Characters Valid', () => {
    it('should return valid:true for exactly 8 character password meeting all requirements', () => {
      const result = validatePassword('Pass123!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #11 - Very Long Valid Password', () => {
    it('should accept very long passwords that meet requirements', () => {
      const result = validatePassword('VeryLongPassword123!WithManyCharacters');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #12 - Multiple Special Characters', () => {
    it('should accept passwords with multiple special characters', () => {
      const result = validatePassword('P@ssw0rd!#$%');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #13 - Only Special Characters', () => {
    it('should reject password with only special characters', () => {
      const result = validatePassword('!@#$%^&*');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain both uppercase and lowercase letters');
    });
  });

  describe('Test Case #14 - Password with Spaces', () => {
    it('should accept password with spaces if it meets requirements', () => {
      const result = validatePassword('Pass word123!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #15 - Only Uppercase and Numbers', () => {
    it('should reject password with only uppercase letters and numbers', () => {
      const result = validatePassword('PASSWORD123');
      assert.equal(result.valid, false);
    });
  });

  describe('Test Case #16 - Only Lowercase and Numbers', () => {
    it('should reject password with only lowercase letters and numbers', () => {
      const result = validatePassword('password123');
      assert.equal(result.valid, false);
    });
  });

  describe('Test Case #17 - Different Special Characters', () => {
    it('should accept password with question mark as special character', () => {
      const result = validatePassword('Password123?');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #18 - Colon as Special Character', () => {
    it('should accept password with colon as special character', () => {
      const result = validatePassword('Password123:');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #19 - Pipe as Special Character', () => {
    it('should accept password with pipe as special character', () => {
      const result = validatePassword('Password123|');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #20 - Less Than/Greater Than Signs', () => {
    it('should accept password with angle brackets as special characters', () => {
      const result = validatePassword('Password123<>');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #21 - All Lowercase with Special Char', () => {
    it('should reject password with all lowercase, number, and special char but no uppercase', () => {
      const result = validatePassword('password123!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain both uppercase and lowercase letters');
    });
  });

  describe('Test Case #22 - All Uppercase with Special Char', () => {
    it('should reject password with all uppercase, number, and special char but no lowercase', () => {
      const result = validatePassword('PASSWORD123!');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain both uppercase and lowercase letters');
    });
  });

  describe('Test Case #23 - Mixed Case Letters Only', () => {
    it('should reject password with only mixed case letters', () => {
      const result = validatePassword('PasswordOnly');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain at least one number');
    });
  });

  describe('Test Case #24 - Mixed Case with Numbers Only', () => {
    it('should reject password with mixed case and numbers but no special char', () => {
      const result = validatePassword('Password123');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain at least one special character');
    });
  });

  describe('Test Case #25 - Password Starting with Number', () => {
    it('should accept password starting with number', () => {
      const result = validatePassword('1Password!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #26 - Password Starting with Special Character', () => {
    it('should accept password starting with special character', () => {
      const result = validatePassword('!Password123');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #27 - Multiple Numbers', () => {
    it('should accept password with multiple numbers', () => {
      const result = validatePassword('Pass1234567!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #28 - Minimum Valid Password', () => {
    it('should accept minimal password meeting all requirements', () => {
      const result = validatePassword('Aa1!Aa1!');
      assert.equal(result.valid, true);
    });
  });

  describe('Test Case #29 - Password with Underscore', () => {
    it('should reject password with underscore (not a special character)', () => {
      const result = validatePassword('Password_123');
      assert.equal(result.valid, false);
      assert.equal(result.message, 'Password must contain at least one special character');
    });
  });

  describe('Test Case #30 - Password with Comma', () => {
    it('should accept password with comma as special character', () => {
      const result = validatePassword('Password123,');
      assert.equal(result.valid, true);
    });
  });
});