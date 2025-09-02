import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDeviceDrawer } from './edit-device-drawer';

describe('EditDeviceDrawer', () => {
  let component: EditDeviceDrawer;
  let fixture: ComponentFixture<EditDeviceDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditDeviceDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditDeviceDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
