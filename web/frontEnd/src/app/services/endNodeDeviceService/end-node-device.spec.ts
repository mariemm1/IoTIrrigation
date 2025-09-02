import { TestBed } from '@angular/core/testing';

import { EndNodeDevice } from './end-node-device';

describe('EndNodeDevice', () => {
  let service: EndNodeDevice;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EndNodeDevice);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
