import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrgEdit } from './org-edit';

describe('OrgEdit', () => {
  let component: OrgEdit;
  let fixture: ComponentFixture<OrgEdit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrgEdit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrgEdit);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
