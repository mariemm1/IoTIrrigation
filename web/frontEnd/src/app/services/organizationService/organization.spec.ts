import { TestBed } from '@angular/core/testing';

import { Etablissement } from './organization';

describe('Etablissement', () => {
  let service: Etablissement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Etablissement);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
