import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrgAdd } from './org-add';

describe('OrgAdd', () => {
  let component: OrgAdd;
  let fixture: ComponentFixture<OrgAdd>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgAdd]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrgAdd);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
