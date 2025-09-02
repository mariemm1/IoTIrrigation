import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddDeviceDrawer } from './add-device-drawer';

describe('AddDeviceDrawer', () => {
  let component: AddDeviceDrawer;
  let fixture: ComponentFixture<AddDeviceDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDeviceDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDeviceDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
