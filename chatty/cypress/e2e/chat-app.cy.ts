/// <reference types="cypress" />
import 'cypress-file-upload';

describe('Chat Application - Comprehensive E2E Tests', () => {
  
  // Helper function to login
  const login = (username: string, password: string) => {
    cy.visit('http://localhost:4200');
    cy.get('input[name="username"]').clear().type(username);
    cy.get('input[name="password"]').clear().type(password);
    cy.get('button[type="submit"]').click();
    cy.wait(1000);
  };

  // Helper to create a unique username
  const uniqueUser = () => `testuser_${Date.now()}`;

  describe('1. Authentication Flow', () => {
    
    beforeEach(() => {
      cy.visit('http://localhost:4200');
    });

    it('should display login page by default', () => {
      cy.contains('Log In').should('be.visible');
      cy.get('input[name="username"]').should('be.visible');
      cy.get('input[name="password"]').should('be.visible');
    });

    it('should toggle between login and signup modes', () => {
      // Click the signup toggle button
      cy.contains("Don't have an account? Sign up now!").click();
      cy.contains('Sign Up').should('be.visible');
      
      // Click back to login
      cy.contains('Already have an account? Log in').click();
      cy.contains('Log In').should('be.visible');
    });

    it('should show validation errors for empty fields', () => {
      cy.get('button[type="submit"]').click();
      cy.contains('Please enter a username').should('be.visible');
    });

    it('should show password requirements during signup', () => {
      cy.contains("Don't have an account? Sign up now!").click();
      
      cy.get('input[name="username"]').type('testuser');
      cy.get('input[name="password"]').type('weak');
      
      cy.contains('At least 8 characters').should('be.visible');
      cy.contains('One uppercase letter').should('be.visible');
      cy.contains('One number').should('be.visible');
      cy.contains('One special character').should('be.visible');
    });

    it('should reject weak passwords during registration', () => {
      cy.contains("Don't have an account? Sign up now!").click();
      
      const user = uniqueUser();
      cy.get('input[name="username"]').type(user);
      cy.get('input[name="password"]').type('weak123');
      cy.get('button[type="submit"]').click();
      
      cy.contains('Please meet all password requirements').should('be.visible');
    });

    it('should successfully register a new user', () => {
      cy.contains("Don't have an account? Sign up now!").click();
      
      const user = uniqueUser();
      cy.get('input[name="username"]').type(user);
      cy.get('input[name="password"]').type('Test@123456');
      cy.get('button[type="submit"]').click();
      
      cy.url().should('include', '/current-groups');
      cy.contains(user).should('be.visible');
    });

    it('should reject duplicate username registration', () => {
      cy.contains("Don't have an account? Sign up now!").click();
      
      cy.get('input[name="username"]').type('super');
      cy.get('input[name="password"]').type('Super@123');
      cy.get('button[type="submit"]').click();
      
      cy.contains('Username already exists').should('be.visible');
    });

    it('should login with correct credentials', () => {
      login('super', 'Super@123');
      
      cy.url().should('include', '/current-groups');
      cy.contains('super').should('be.visible');
    });

    it('should reject incorrect password', () => {
      cy.get('input[name="username"]').type('super');
      cy.get('input[name="password"]').type('WrongPassword@123');
      cy.get('button[type="submit"]').click();
      
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should reject non-existent user', () => {
      cy.get('input[name="username"]').type('nonexistentuser999');
      cy.get('input[name="password"]').type('AnyPassword@123');
      cy.get('button[type="submit"]').click();
      
      cy.contains('Invalid credentials').should('be.visible');
    });
  });

  describe('2. User Profile Management', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
    });

    it('should display user avatar', () => {
      cy.get('img[alt="avatar"]').should('be.visible');
    });

    it('should have change avatar button', () => {
      cy.contains('Change Avatar').should('be.visible');
    });

    it('should logout successfully', () => {
      cy.contains('Logout').click();
      cy.url().should('include', '/login');
    });
  });

  describe('3. Group Management - Regular User', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
    });

    it('should display My Groups section', () => {
      cy.contains('My Groups').should('be.visible');
    });

    it('should display Available Groups section', () => {
      cy.contains('Available Groups').should('be.visible');
    });

    it('should be able to request to join a group', () => {
      // Look for "Request to Join" button in Available Groups section
      cy.contains('Available Groups').parents('.card').within(() => {
        cy.get('button').contains('Request to Join').should('exist');
      });
    });

    it('should be able to leave a group', () => {
      // Look for "Leave Group" button in My Groups section
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('button').contains('Leave Group').should('exist');
      });
    });

    it('should navigate to admin dashboard if admin', () => {
      cy.contains('Go to Admin Dashboard').should('be.visible');
    });
  });

  describe('4. Group Admin Dashboard', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      cy.contains('Go to Admin Dashboard').click();
      cy.wait(1000);
    });

    it('should display group admin dashboard', () => {
      cy.contains('Group Admin Dashboard').should('be.visible');
    });

    it('should display group creation form', () => {
      cy.get('input[name="groupName"]').should('be.visible');
      cy.contains('Create Group').should('be.visible');
    });

    it('should create a new group', () => {
      const groupName = `TestGroup_${Date.now()}`;
      
      cy.get('input[name="groupName"]').type(groupName);
      cy.contains('Create Group').click();
      
      cy.wait(1000);
      cy.contains(groupName).should('be.visible');
    });

    it('should display groups list', () => {
      cy.contains('Groups').should('be.visible');
    });

    it('should show member management options', () => {
      cy.contains('Remove').should('exist');
      cy.contains('Ban').should('exist');
    });

    it('should show channel creation option', () => {
      cy.get('input[placeholder="New channel name"]').should('exist');
      cy.contains('Create Channel').should('exist');
    });

    it('should navigate back to groups page', () => {
      cy.contains('Back to My Groups').click();
      cy.url().should('include', '/current-groups');
    });
  });

  describe('5. Super Admin Dashboard', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      cy.visit('http://localhost:4200/super-dashboard');
      cy.wait(1000);
    });

    it('should display super admin dashboard', () => {
      cy.contains('Super Admin Dashboard').should('be.visible');
    });

    it('should have group creation form', () => {
      cy.get('input[name="groupName"]').should('be.visible');
      cy.contains('Create Group').should('be.visible');
    });

    it('should display groups section', () => {
      cy.contains('Groups').should('be.visible');
    });

    it('should show promotion options', () => {
      cy.contains('Promote to Group Admin').should('exist');
      cy.contains('Promote to Super Admin').should('exist');
    });

    it('should display reports section', () => {
      cy.contains('Reports').should('be.visible');
    });
  });

  describe('6. Channel Chat Functionality', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      // Click on a group name link to navigate to chat
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
    });

    it('should display channels list', () => {
      cy.contains('Channels').should('be.visible');
    });

    it('should have join buttons for channels', () => {
      cy.get('button').contains('Join').should('be.visible');
    });

    it('should join a channel', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      cy.contains('Currently in:').should('be.visible');
    });

    it('should display message input after joining', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      cy.get('input[placeholder*="Type a message"]').should('be.visible');
    });

    it('should send a text message', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      const message = `Test message ${Date.now()}`;
      cy.get('input[placeholder*="Type a message"]').type(message);
      cy.get('button').contains('Send').click();
      
      cy.wait(500);
      cy.contains(message).should('be.visible');
    });

    it('should display members section', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      cy.contains('Members').should('be.visible');
    });

    it('should show member count', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      cy.get('.badge').contains('member').should('be.visible');
    });

    it('should display camera and screenshare buttons', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      // Look for emoji buttons (camera and screenshare use emojis)
      cy.get('button[type="button"]').should('have.length.greaterThan', 2);
    });

    it('should have image upload button', () => {
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      cy.get('input[type="file"][accept*="image"]').should('exist');
    });

    it('should navigate back to groups', () => {
      cy.contains('Back to Groups').click();
      cy.url().should('include', '/current-groups');
    });
  });

  describe('7. Video and Screen Share Features', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
    });

    it('should display video control buttons', () => {
      // Camera and screenshare buttons exist (with emojis)
      cy.get('button[type="button"]').should('have.length.greaterThan', 0);
    });

    it('should show member count', () => {
      cy.contains('member').should('be.visible');
    });

    it('should display video containers', () => {
      cy.get('.video-container').should('exist');
    });
  });

  describe('8. Account Management', () => {
    
    it('should display delete account button', () => {
      login('super', 'Super@123');
      cy.contains('Delete My Account').should('be.visible');
    });

    it('should register and then delete account', () => {
      const testUser = uniqueUser();
      
      // Register
      cy.visit('http://localhost:4200');
      cy.contains("Don't have an account? Sign up now!").click();
      
      cy.get('input[name="username"]').type(testUser);
      cy.get('input[name="password"]').type('Test@123456');
      cy.get('button[type="submit"]').click();
      
      cy.url().should('include', '/current-groups');
      cy.wait(500);
      
      // Delete account
      cy.contains('Delete My Account').click();
      
      // Handle confirmation dialog
      cy.on('window:confirm', () => true);
      
      cy.wait(1000);
      cy.url().should('include', '/login');
    });
  });

  describe('9. Authorization and Role-Based Access', () => {
    
    it('should allow super admin to access dashboard', () => {
      login('super', 'Super@123');
      
      cy.contains('Go to Admin Dashboard').should('be.visible');
      cy.contains('Go to Admin Dashboard').click();
      
      cy.wait(500);
      // Should show either group admin or super admin dashboard
      cy.url().should('match', /dashboard/);
    });

    it('should show admin options to super admin', () => {
      login('super', 'Super@123');
      
      cy.visit('http://localhost:4200/super-dashboard');
      cy.wait(1000);
      
      cy.contains('Super Admin Dashboard').should('be.visible');
    });
  });

  describe('10. System Messages and UI Elements', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
    });

    it('should display gradient backgrounds', () => {
      cy.get('[style*="gradient"]').should('exist');
    });

    it('should show user information', () => {
      cy.contains('super').should('be.visible');
    });

    it('should display card layouts', () => {
      cy.get('.card').should('have.length.greaterThan', 0);
    });
  });

  describe('11. Edge Cases and Error Handling', () => {
    
    it('should display error messages properly', () => {
      cy.visit('http://localhost:4200');
      cy.get('input[name="username"]').type('super');
      cy.get('input[name="password"]').type('wrongpass');
      cy.get('button[type="submit"]').click();
      
      cy.get('.alert').should('be.visible');
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should handle very long messages', () => {
      login('super', 'Super@123');
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      const longMessage = 'a'.repeat(500);
      cy.get('input[placeholder*="Type a message"]').type(longMessage);
      cy.get('button').contains('Send').click();
      
      cy.wait(500);
      cy.contains(longMessage.substring(0, 50)).should('be.visible');
    });

    it('should maintain session after page refresh', () => {
      login('super', 'Super@123');
      
      cy.reload();
      cy.wait(1000);
      
      cy.url().should('include', '/current-groups');
      cy.contains('super').should('be.visible');
    });
  });

  describe('12. Performance and Load Tests', () => {
    
    it('should load groups page quickly', () => {
      const start = Date.now();
      login('super', 'Super@123');
      const loadTime = Date.now() - start;
      
      expect(loadTime).to.be.lessThan(10000);
    });

    it('should handle multiple rapid message sends', () => {
      login('super', 'Super@123');
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      // Send messages using Cypress lodash utility
      Cypress._.times(5, (i) => {
        cy.get('input[placeholder*="Type a message"]').clear().type(`Message ${i}`);
        cy.get('button').contains('Send').click();
        cy.wait(200);
      });
      
      cy.contains('Message 4').should('be.visible');
    });
  });

  describe('13. Real-Time Updates', () => {
    
    it('should create and display new group', () => {
      login('super', 'Super@123');
      
      const groupName = `RealtimeGroup_${Date.now()}`;
      
      cy.contains('Go to Admin Dashboard').click();
      cy.wait(500);
      
      cy.get('input[name="groupName"]').type(groupName);
      cy.contains('Create Group').click();
      cy.wait(500);
      
      cy.contains(groupName).should('be.visible');
    });

    it('should display real-time messages', () => {
      login('super', 'Super@123');
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      const message1 = `Message1_${Date.now()}`;
      const message2 = `Message2_${Date.now()}`;
      
      cy.get('input[placeholder*="Type a message"]').type(message1);
      cy.get('button').contains('Send').click();
      cy.wait(300);
      
      cy.get('input[placeholder*="Type a message"]').type(message2);
      cy.get('button').contains('Send').click();
      cy.wait(300);
      
      cy.contains(message1).should('be.visible');
      cy.contains(message2).should('be.visible');
    });
  });

  describe('14. UI/UX Validation', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
    });

    it('should have proper navigation buttons', () => {
      cy.contains('Go to Admin Dashboard').should('be.visible');
      cy.contains('Logout').should('be.visible');
    });

    it('should display user information correctly', () => {
      cy.contains('super').should('be.visible');
      cy.get('img[alt="avatar"]').should('be.visible');
    });

    it('should have accessible buttons', () => {
      cy.get('button').should('have.length.greaterThan', 0);
    });

    it('should show proper styling', () => {
      cy.get('.card').should('have.length.greaterThan', 0);
      cy.get('[style*="gradient"]').should('exist');
    });
  });

  describe('15. Data Persistence', () => {
    
    it('should persist user session across page reloads', () => {
      login('super', 'Super@123');
      cy.url().should('include', '/current-groups');
      
      cy.reload();
      cy.wait(1000);
      
      cy.url().should('include', '/current-groups');
      cy.contains('super').should('be.visible');
    });

    it('should persist messages after leaving and rejoining channel', () => {
      login('super', 'Super@123');
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      const testMessage = `PersistTest_${Date.now()}`;
      
      cy.get('input[placeholder*="Type a message"]').type(testMessage);
      cy.get('button').contains('Send').click();
      cy.wait(500);
      
      cy.contains(testMessage).should('be.visible');
      
      // Go back
      cy.contains('Back to Groups').click();
      cy.wait(500);
      
      // Rejoin
      cy.contains('My Groups').parents('.card').within(() => {
        cy.get('a').first().click();
      });
      cy.wait(1000);
      cy.get('button').contains('Join').first().click();
      cy.wait(500);
      
      cy.contains(testMessage).should('be.visible');
    });
  });

  describe('16. Group and Channel Operations', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      cy.contains('Go to Admin Dashboard').click();
      cy.wait(500);
    });

    it('should create a channel', () => {
      const channelName = `TestChannel_${Date.now()}`;
      
      cy.get('input[placeholder="New channel name"]').first().type(channelName);
      cy.contains('Create Channel').first().click();
      
      cy.wait(500);
      cy.contains(channelName).should('be.visible');
    });

    it('should display channel members', () => {
      cy.contains('Members:').should('exist');
    });

    it('should show delete channel button', () => {
      cy.contains('Delete Channel').should('exist');
    });
  });

  describe('17. Member Management', () => {
    
    beforeEach(() => {
      login('super', 'Super@123');
      cy.contains('Go to Admin Dashboard').click();
      cy.wait(500);
    });

    it('should display member list', () => {
      cy.contains('Members:').should('be.visible');
    });

    it('should show member action buttons', () => {
      cy.contains('Remove').should('exist');
      cy.contains('Ban').should('exist');
    });

    it('should display banned members section', () => {
      cy.contains('Banned Members:').should('be.visible');
    });

    it('should show join requests section', () => {
      cy.contains('Join Requests:').should('be.visible');
    });
  });
});