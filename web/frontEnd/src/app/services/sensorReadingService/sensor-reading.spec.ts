import { TestBed } from '@angular/core/testing';

import { SensorReading } from './sensor-reading';

describe('SensorReading', () => {
  let service: SensorReading;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SensorReading);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
