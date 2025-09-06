import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SuperDashboard } from './super-dashboard';

describe('SuperDashboard', () => {
  let component: SuperDashboard;
  let fixture: ComponentFixture<SuperDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SuperDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SuperDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
