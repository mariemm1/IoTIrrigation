import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapDrawer } from './map-drawer';

describe('MapDrawer', () => {
  let component: MapDrawer;
  let fixture: ComponentFixture<MapDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MapDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
