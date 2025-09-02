import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RangeExplorerDrawer } from './range-explorer-drawer';

describe('RangeExplorerDrawer', () => {
  let component: RangeExplorerDrawer;
  let fixture: ComponentFixture<RangeExplorerDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RangeExplorerDrawer]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RangeExplorerDrawer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
