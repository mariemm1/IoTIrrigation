import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IrrigationDrawer } from './irrigation-drawer';

describe('IrrigationDrawer', () => {
  let component: IrrigationDrawer;
  let fixture: ComponentFixture<IrrigationDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IrrigationDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IrrigationDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
