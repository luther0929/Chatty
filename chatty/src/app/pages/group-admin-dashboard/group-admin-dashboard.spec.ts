import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroupAdminDashboard } from './group-admin-dashboard';

describe('GroupAdminDashboard', () => {
  let component: GroupAdminDashboard;
  let fixture: ComponentFixture<GroupAdminDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroupAdminDashboard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GroupAdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
