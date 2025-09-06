import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurrentGroups } from './current-groups';

describe('CurrentGroups', () => {
  let component: CurrentGroups;
  let fixture: ComponentFixture<CurrentGroups>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrentGroups]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurrentGroups);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
