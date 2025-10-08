describe('Chat Application E2E Tests', () => {
  
  beforeEach(() => {
    cy.visit('http://localhost:4200');
  });

  describe('User Registration and Password Validation', () => {
    
    it('should display login page by default', () => {
      cy.contains('Log In').should('be.visible');
    });

    it('should toggle to signup mode', () => {
      cy.contains('Sign up now').click();
      cy.contains('Sign Up').should('be.visible');
    });

    it('should show password requirements during signup', () => {
      cy.contains('Sign up now').click();
      
      cy.get('input[name="username"]').type('testuser');
      cy.get('input[name="password"]').type('weak');
      
      cy.contains('At least 8 characters').should('be.visible');
      cy.contains('One uppercase letter').should('be.visible');
      cy.contains('One number').should('be.visible');
      cy.contains('One special character').should('be.visible');
    });
  });

  describe('User Login with Encrypted Password', () => {
    
    it('should login with correct credentials', () => {
      cy.get('input[name="username"]').type('super');
      cy.get('input[name="password"]').type('Super@123');
      cy.get('button[type="submit"]').click();
      
      cy.url().should('include', '/current-groups');
      cy.contains('super').should('be.visible');
    });

    it('should show error with wrong password', () => {
      cy.get('input[name="username"]').type('super');
      cy.get('input[name="password"]').type('wrongpass');
      cy.get('button[type="submit"]').click();
      
      cy.contains('Invalid credentials').should('be.visible');
    });
  });
});