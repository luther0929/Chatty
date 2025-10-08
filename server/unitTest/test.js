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
});