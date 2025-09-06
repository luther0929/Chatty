import { TestBed } from '@angular/core/testing';

import { Sockets } from './sockets';

describe('Sockets', () => {
  let service: Sockets;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sockets);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
