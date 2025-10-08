import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { CurrentGroups } from './current-groups';

describe('CurrentGroups', () => {
  let component: CurrentGroups;
  let fixture: ComponentFixture<CurrentGroups>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrentGroups, HttpClientTestingModule]
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
