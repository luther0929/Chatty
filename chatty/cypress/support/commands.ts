/// <reference types="cypress" />
import 'cypress-file-upload';

// Custom command examples (optional - you can add more)
Cypress.Commands.add('login', (username: string, password: string) => {
  cy.visit('http://localhost:4200');
  cy.get('input[name="username"]').clear().type(username);
  cy.get('input[name="password"]').clear().type(password);
  cy.get('button[type="submit"]').click();
});

// Declare custom commands for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      login(username: string, password: string): Chainable<void>;
    }
  }
}

export {};