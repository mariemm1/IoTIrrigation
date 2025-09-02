import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeviceCard } from './device-card';

describe('DeviceCard', () => {
  let component: DeviceCard;
  let fixture: ComponentFixture<DeviceCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeviceCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeviceCard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
