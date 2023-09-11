/*
 * Deepkit Framework
 * Copyright (C) 2021 Deepkit UG, Marc J. Schmidt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 * You should have received a copy of the MIT License along with this program.
 */

import { Injector } from '@deepkit/injector';
import { render } from '@deepkit/template';
import { createElement, safeString } from '@deepkit/template/jsx-runtime';
import { BenchSuite } from '../../bench.js';
import { Website } from './website.js';

const template1 = () => <div>Test</div>;

function Head({}, children: string) {
    return <div>Yes {children}</div>;
}

const template2 = () =>
    <Website title="Test">
        <Head>Nix</Head>
        <div>Content</div>
    </Website>;

const injector = new Injector();

export async function main() {
    const bench = new BenchSuite('template');

    bench.add('render simple async', async () => {
        const t = template1();
        await render(injector, t);
    });

    bench.add('render complex async', async () => {
        const t = template2();
        await render(injector, t);
    });

    function Test() {
        return '';
    }

    const title = 'asd';
    const contents = 'content';

    bench.add('construct website', () => {
        Website({title: 'd'});
    });

    const struct = Website({title: 'd'});
    bench.add('render website', async () => {
        await render(injector, Website({title: 'd'}));
    });

    bench.add('construct objects', () => {
        [{
            [safeString]: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></meta><meta http-equiv="X-UA-Compatible" content="IE=edge"></meta><title>Marc J. Schmidt // entrepreneur, freelance AI & full-stack developer from Hamburg, Germany.</title><base href="/"></base><meta name="viewport" content="width=device-width, initial-scale=1"></meta><link rel="shortcut icon" href="/assets/favicon.png" type="image/png"></link><meta name="description" content="Entrepreneur, freelance AI & full-stack developer from Hamburg, Germany"></meta><link rel="canonical" href="http://marcjschmidt.de/"></link><meta name="referrer" content="no-referrer-when-downgrade"></meta><meta property="og:site_name" content="Marc J. Schmidt"></meta><meta property="og:type" content="website"></meta><meta property="og:title" content="Marc J. Schmidt"></meta><meta property="og:description" content="Entrepreneur, freelance AI & full-stack developer from Hamburg, Germany"></meta><meta property="og:url" content="http://marcjschmidt.de/"></meta><meta name="twitter:card" content="summary_large_image"></meta><meta name="twitter:title" content="Marc J. Schmidt"></meta><meta name="twitter:description" content="Entrepreneur, freelance AI & full-stack developer from Hamburg, Germany"></meta><meta name="twitter:url" content="http://marcjschmidt.de/"></meta><meta property="og:image:width" content="2000"></meta><meta property="og:image:height" content="666"></meta></head><body>'
        }, createElement(Test, {}), {
            [safeString]: '<h1>'
        }, title, {
            [safeString]: '</h1><div id="wrapper">'
        }, contents, {
            [safeString]: '</div><dialog id="customization-menu" class="customize-dialog"><div id="menu-nav-panel" role="tablist" aria-label="Customise this page"><button id="backgrounds-button" class="menu-option" tabIndex="0" role="tab" aria-controls="backgrounds-menu backgrounds-image-menu" aria-selected="true" aria-labelledby="backgrounds-menu-option" title="Background"><div class="menu-option-icon-wrapper"><div id="backgrounds-icon" class="menu-option-icon"></div></div><div id="backgrounds-menu-option" class="menu-option-label">Background</div></button><button id="shortcuts-button" class="menu-option" tabIndex="0" role="tab" aria-controls="shortcuts-menu" aria-selected="false" aria-labelledby="shortcuts-menu-option" title="Shortcuts"><div class="menu-option-icon-wrapper"><div id="shortcuts-icon" class="menu-option-icon"></div></div><div id="shortcuts-menu-option" class="menu-option-label">Shortcuts</div></button><button id="colors-button" class="menu-option" tabIndex="0" role="tab" aria-controls="colors-menu" aria-selected="false" aria-labelledby="colors-menu-option" title="Colour and theme"><div class="menu-option-icon-wrapper"><div id="colors-icon" class="menu-option-icon"></div></div><div id="colors-menu-option" class="menu-option-label">Colour and theme</div></button></div><div id="menu-contents"><div id="menu-header"><div id="menu-back-circle" tabIndex="0" role="button" aria-label="Back" title="Back"><div id="menu-back"></div></div><div id="menu-title">Customise this page</div><div id="refresh-daily-wrapper"><div id="refresh-toggle-wrapper" title="Refresh daily"><label class="switch"><input id="refresh-daily-toggle" type="checkbox" aria-labelledby="refresh-text"></input><span class="toggle"><div class="knob"></div><div class="highlight"></div></span></label></div><div id="refresh-text">Refresh daily</div></div></div><div id="backgrounds-menu" class="menu-panel" tabIndex="0" role="tabpanel" aria-label="Background"><div id="backgrounds-upload" class="bg-sel-tile-bg"><div id="backgrounds-upload-icon" class="bg-sel-tile" tabIndex="1" role="button" aria-label="Upload from device" aria-pressed="false" title="Upload from device"><div id="backgrounds-upload-arrow"></div><div id="backgrounds-upload-text">Upload from device</div></div></div><div id="backgrounds-default" class="bg-sel-tile-bg"><div id="backgrounds-default-icon" class="bg-sel-tile" tabIndex="1" role="button" aria-label="No background" title="No background" aria-pressed="false"><div class="mini-page"><div class="mini-header-colorful"></div><div class="mini-shortcuts"></div></div></div><div class="bg-sel-tile-title">No background</div></div></div><div id="backgrounds-image-menu" class="menu-panel" tabIndex="0" role="tabpanel" aria-label="Background"></div><div id="backgrounds-disabled-menu" class="menu-panel" tabIndex="0" role="tabpanel" aria-label="Background"><div id="backgrounds-disabled-wrapper"><div id="backgrounds-disabled-icon"></div><div id="backgrounds-disabled-title">Custom backgrounds have been turned off by your administrator</div></div></div><div id="shortcuts-menu" class="menu-panel" tabIndex="0" role="tabpanel" aria-label="Shortcuts"><div id="sh-options"><div class="sh-option"><div id="sh-option-cl" class="sh-option-image" tabIndex="1" role="button" aria-pressed="false" aria-labelledby="sh-option-cl-title" title="My shortcuts"><div class="sh-option-icon"></div><div class="sh-option-mini"><div class="mini-page"><div class="mini-header"></div><div class="mini-shortcuts"></div></div></div></div><div id="sh-option-cl-title" class="sh-option-title">My shortcuts</div>Shortcuts are curated by you</div><div class="sh-option"><div id="sh-option-mv" class="sh-option-image" tabIndex="1" role="button" aria-pressed="false" aria-labelledby="sh-option-mv-title" title="Most-visited sites"><div class="sh-option-icon"></div><div class="sh-option-mini"><div class="mini-page"><div class="mini-header"></div><div class="mini-shortcuts"></div></div></div></div><div id="sh-option-mv-title" class="sh-option-title">Most-visited sites</div>Shortcuts are suggested based on websites that you visit often</div></div><div id="sh-hide"><div id="sh-hide-icon"></div><div><div id="sh-hide-title">Hide shortcuts</div>Don\'t show shortcuts on this page</div><div id="sh-hide-toggle-wrapper" title="Hide shortcuts"><label class="switch"><input id="sh-hide-toggle" type="checkbox" tabIndex="1" aria-labelledby="sh-hide-title"></input><span class="toggle"><div class="knob"></div><div class="highlight"></div></span></label></div></div></div><div id="colors-menu" class="menu-panel" role="tabpanel" aria-label="Colour and theme"><div id="colors-theme"><div id="colors-theme-icon"></div><div id="colors-theme-info"><div id="colors-theme-name"></div>Current theme that you have installed</div><a id="colors-theme-link" target="_blank"><div id="colors-theme-link-icon"></div></a><button id="colors-theme-uninstall" class="paper secondary">Uninstall</button></div><div id="color-picker-container" class="bg-sel-tile-bg"><div id="color-picker-tile" class="bg-sel-tile" aria-label="Select colour" title="Select colour" role="button" aria-pressed="false"><div id="left-semicircle"></div><div id="color-picker-icon"></div><input id="color-picker" type="color" style="display:none"></input></div></div>tabIndex<div id="colors-default" class="bg-sel-tile-bg"><div id="colors-default-icon" class="bg-sel-tile" aria-label="Default" title="Default" role="button" aria-pressed="false"></div></div></div></div><div id="menu-footer"><button id="menu-cancel" class="bg-sel-footer-button paper secondary ripple" title="Cancel">Cancel</button><button id="menu-done" class="bg-sel-footer-button paper primary ripple" title="Done">Done</button></div></dialog><script></script><script src="runtime.858f8dd898b75fe86926.js"></script><script src="polyfills.bc8d34c56577aa316503.js"></script><script src="main.01349520b4306e76e431.js"></script></body></html>'
        }];
    });

    await bench.runAsync();
}
