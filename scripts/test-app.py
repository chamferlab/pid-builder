#!/usr/bin/env python3
"""Browser regression tests, run through Firefox using Marionette; no Python dependencies.

Covers undo/redo, saved-project compatibility, and the editing tools.

Run directly to start a temporary headless Firefox, or pass --port to use an
existing Firefox started with --headless --marionette and a temporary profile.
"""
import argparse
import json
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
STORAGE = 'seal-loop-pid-v1'


class Browser:
    def __init__(self, port):
        self.socket = socket.create_connection(('127.0.0.1', port), timeout=10)
        self.sequence = 0
        self.read()

    def read(self):
        prefix = b''
        while not prefix.endswith(b':'):
            chunk = self.socket.recv(1)
            if not chunk:
                raise RuntimeError('Browser connection closed')
            prefix += chunk
        length = int(prefix[:-1])
        data = b''
        while len(data) < length:
            chunk = self.socket.recv(length - len(data))
            if not chunk:
                raise RuntimeError('Browser connection closed')
            data += chunk
        return json.loads(data)

    def call(self, name, args=None):
        self.sequence += 1
        data = json.dumps([0, self.sequence, name, args or {}]).encode()
        self.socket.sendall(str(len(data)).encode() + b':' + data)
        result = self.read()
        if result[2]:
            raise RuntimeError(result[2])
        return result[3]

    def js(self, script, args=None):
        return self.call('WebDriver:ExecuteScript', {
            'script': script, 'args': args or [], 'newSandbox': False,
        })['value']

    def async_js(self, script, args=None):
        return self.call('WebDriver:ExecuteAsyncScript', {
            'script': script, 'args': args or [],
        })['value']


def run_tests(browser):
    b = browser
    url = (ROOT / 'PID-Builder.html').as_uri()
    b.call('WebDriver:Navigate', {'url': url})
    b.js('localStorage.clear();return true')
    b.call('WebDriver:Navigate', {'url': url})

    def state():
        return b.js(f"return JSON.parse(localStorage.getItem('{STORAGE}'))")

    def click(element_id):
        b.js('document.getElementById(arguments[0]).click();return true', [element_id])

    def select(index):
        b.js('''const n=document.querySelectorAll('#nodes>.node')[arguments[0]],p=new DOMPoint(0,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''', [index])

    def add(kind):
        b.js('document.querySelector(`[data-kind="${arguments[0]}"]`).click();return true', [kind])

    def near(node, x, y):
        # Pointer events carry whole pixels, so free placement is exact only to about one drawing unit.
        return abs(node['x'] - x) <= 1 and abs(node['y'] - y) <= 1

    def roundtrip(action, label):
        before = state()
        action()
        after = state()
        assert after != before, label + ': action did not change the drawing'
        click('undo')
        assert state() == before, label + ': undo mismatch'
        click('redo')
        assert state() == after, label + ': redo mismatch'
        print('PASS:', label, flush=True)

    def edit(field, values):
        b.js('''for(const value of arguments[1]){const input=document.getElementById(arguments[0]);input.focus();input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}return true;''', [field, values])

    def load(project):
        b.async_js('''const done=arguments[arguments.length-1],input=document.getElementById('projectFile'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(arguments[0])],'test.json',{type:'application/json'}));input.files=dt.files;input.onchange({target:input}).then(()=>done(true));''', [project])

    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")
    def drop_symbol(x, y, alt=False):
        b.js('''const svg=document.getElementById('drawing'),p=new DOMPoint(arguments[0],arguments[1]).matrixTransform(svg.getScreenCTM()),dt=new DataTransfer();dt.setData('text/plain','PI');document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,altKey:arguments[2],cancelable:true}));return true;''', [x, y, alt])

    def drag_symbol(x, y, alt=False):
        b.js('''const n=document.querySelector('#nodes>.node'),svg=document.getElementById('drawing'),from=new DOMPoint(0,0).matrixTransform(n.getScreenCTM()),to=new DOMPoint(arguments[0],arguments[1]).matrixTransform(svg.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:from.x,clientY:from.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:to.x,clientY:to.y,altKey:arguments[2]}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''', [x, y, alt])

    empty_project = dict(title='Snap fixture', nodes=[], pipes=[], nextId=1, sealSvg=None, portModeVersion=3)
    junction_ports = [dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0), dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)]
    legacy_project = dict(title='Legacy ports', nodes=[
        dict(id='n0', kind='seal', x=150, y=300, w=455, h=500, tag='SEAL', notes='', ports=[dict(id='T1', x=-125, y=-236)]),
        dict(id='n1', kind='PI', x=450, y=300, w=90, h=90, tag='PI', notes='', ports=[dict(id='R', x=45, y=0)]),
        dict(id='n2', kind='junction', x=750, y=300, w=44, h=44, tag='', notes='', ports=junction_ports),
        dict(id='n3', kind='junction', x=1050, y=300, w=44, h=44, tag='', notes='', ports=junction_ports),
    ], pipes=[
        dict(id='n4', a=dict(node='n0', port='T1'), b=dict(node='n2', port='L')),
        dict(id='n5', a=dict(node='n1', port='R'), b=dict(node='n2', port='T')),
        dict(id='n6', a=dict(node='n2', port='R'), b=dict(node='n3', port='L')),
    ], nextId=7, sealSvg=None)
    b.js(f"localStorage.setItem('{STORAGE}',JSON.stringify(arguments[0]));return true", [legacy_project])
    b.call('WebDriver:Navigate', {'url': url})
    migrated = state()
    assert migrated['portModeVersion'] == 3 and all(not node['ports'] for node in migrated['nodes'])
    assert not migrated['pipes']
    assert b.js("return JSON.parse(localStorage.getItem('seal-loop-pid-v1-before-all-manual-ports'))") == legacy_project
    load(legacy_project)
    assert not state()['pipes']
    load(dict(legacy_project, portModeVersion=2))
    assert not state()['pipes'] and state()['nodes'][0]['ports'] and state()['nodes'][1]['ports']
    assert not state()['nodes'][2]['ports'] and not state()['nodes'][3]['ports']
    load(dict(legacy_project, portModeVersion=3))
    assert len(state()['pipes']) == 3 and all(node['ports'] for node in state()['nodes'])
    roundtrip(lambda: b.js("""document.querySelector('[data-node="n1"][data-port="R"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,altKey:true}));return true"""), 'remove connected instrument port and pipe')
    assert len(state()['pipes']) == 2 and not state()['nodes'][1]['ports']
    select(0)
    assert b.js("const button=document.querySelector('[data-remove-port=\"T1\"]'),panel=document.querySelector('.inspector');return button&&button.getBoundingClientRect().bottom<=panel.getBoundingClientRect().bottom")
    roundtrip(lambda: b.js("""document.querySelector('[data-remove-port="T1"]').click();return true"""), 'remove connected seal port from Properties')
    assert len(state()['pipes']) == 1 and not state()['nodes'][0]['ports']
    pump_project = dict(title='Manual pump port', nodes=[dict(id='n0', kind='circulating-pump', x=400, y=400, w=190, h=190, tag='PUMP', notes='', ports=[dict(id='P1', x=10, y=-30, custom=True)], artworkSource='media', artworkVersion='older-art')], pipes=[], nextId=1, sealSvg=None, portModeVersion=3)
    load(pump_project)
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    load(empty_project)
    print('PASS: migrate old symbol ports and preserve current manual ports', flush=True)
    for kind in ['air-driven-pump', 'isolation-valve', 'check-valve', 'drain', 'vent']:
        load(empty_project)
        roundtrip(lambda kind=kind: add(kind), f'add {kind}')
        assert state()['nodes'][0]['kind'] == kind and state()['nodes'][0]['ports'] == []
        assert b.js("return document.querySelector('#nodes .symbol-artwork').children.length > 0")
    load(empty_project)
    assert b.js("return document.querySelector('[data-kind=control-valve]').textContent.includes('Pressure control valve')")
    roundtrip(lambda: add('control-valve'), 'add redesigned pressure control valve')
    assert state()['nodes'][0]['ports'] == []
    assert b.js("return atob(document.querySelector('#nodes .symbol-artwork image').getAttribute('href').split(',')[1]).includes('Dome-loaded pressure control valve')")
    valve_fixture = dict(title='Valve insertion', nodes=[
        dict(id='n0', kind='junction', x=200, y=400, w=44, h=44, tag='', notes='', ports=junction_ports),
        dict(id='n1', kind='junction', x=800, y=400, w=44, h=44, tag='', notes='', ports=junction_ports),
    ], pipes=[dict(id='n2', a=dict(node='n0', port='R'), b=dict(node='n1', port='L'), color='red', direction='forward')], nextId=3, sealSvg=None, portModeVersion=3)
    def drop_kind(kind, x, y):
        b.js('''const svg=document.getElementById('drawing'),p=new DOMPoint(arguments[1],arguments[2]).matrixTransform(svg.getScreenCTM()),dt=new DataTransfer();dt.setData('text/plain',arguments[0]);document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,cancelable:true}));return true;''', [kind, x, y])
    for kind in ['isolation-valve', 'check-valve']:
        load(valve_fixture)
        roundtrip(lambda kind=kind: drop_kind(kind, 500, 400), f'insert {kind} into horizontal pipe')
        drawing = state()
        assert len(drawing['nodes']) == 3 and len(drawing['pipes']) == 2
        assert {p['id'] for p in drawing['nodes'][-1]['ports']} == {'L', 'R'}
        assert all(p['color'] == 'red' and p['direction'] == 'forward' for p in drawing['pipes'])
    vertical_fixture = dict(valve_fixture, nodes=[
        dict(id='n0', kind='junction', x=500, y=150, w=44, h=44, tag='', notes='', ports=junction_ports),
        dict(id='n1', kind='junction', x=500, y=750, w=44, h=44, tag='', notes='', ports=junction_ports),
    ], pipes=[dict(id='n2', a=dict(node='n0', port='B'), b=dict(node='n1', port='T'), direction='reverse')])
    load(vertical_fixture)
    roundtrip(lambda: drop_kind('check-valve', 500, 450), 'insert check valve into reverse-flow vertical pipe')
    assert state()['nodes'][-1]['rotation'] == 270
    assert len(state()['pipes']) == 2
    elbow_fixture = dict(title='L route', nodes=[
        dict(id='n0', kind='junction', x=200, y=200, w=44, h=44, tag='', notes='', ports=junction_ports),
        dict(id='n1', kind='junction', x=800, y=600, w=44, h=44, tag='', notes='', ports=junction_ports),
    ], pipes=[dict(id='n2', a=dict(node='n0', port='R'), b=dict(node='n1', port='L'))], nextId=3, sealSvg=None, portModeVersion=3)
    load(elbow_fixture)
    def select_elbow_pipe():
        b.js("document.querySelector('[data-pipe]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true")
    def pipe_path():
        return b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('d')")
    select_elbow_pipe()
    roundtrip(lambda: click('routeElbowHorizontal'), 'L route horizontal then vertical')
    assert state()['pipes'][0]['route'] == {'elbow': 'horizontal'}
    assert pipe_path() == 'M 222 200 L 778 200 L 778 600'
    select_elbow_pipe()
    assert b.js("return document.querySelectorAll('.elbow-handle').length") == 1
    roundtrip(lambda: click('routeElbowVertical'), 'L route vertical then horizontal')
    assert pipe_path() == 'M 222 200 L 222 600 L 778 600'
    select_elbow_pipe()
    def flip_elbow():
        b.js("document.querySelector('.elbow-handle circle').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true")
    roundtrip(flip_elbow, 'flip L corner from canvas')
    assert pipe_path() == 'M 222 200 L 778 200 L 778 600'
    before_elbow_move = state()
    drag_symbol(250, 250)
    assert state()['pipes'][0]['route'] == {'elbow': 'horizontal'}
    assert pipe_path() == 'M 272 250 L 778 250 L 778 600'
    click('undo')
    assert state() == before_elbow_move
    exported_elbow = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>{const doc=new DOMParser().parseFromString(markup,'image/svg+xml');done([doc.querySelector('#pipes .wire').getAttribute('d'),doc.querySelectorAll('.elbow-handle').length])});return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_elbow == [pipe_path(), 0]
    group_fixture = dict(title='Group edits', nodes=[
        dict(id='n0', kind='junction', x=200, y=220, w=44, h=44, tag='J1', notes='', ports=junction_ports),
        dict(id='n1', kind='PI', x=400, y=400, w=90, h=90, tag='PI1', notes='', ports=[dict(id='L', x=-45, y=0), dict(id='R', x=45, y=0)]),
        dict(id='n2', kind='junction', x=800, y=550, w=44, h=44, tag='J2', notes='', ports=junction_ports),
    ], pipes=[
        dict(id='n3', a=dict(node='n0', port='R'), b=dict(node='n1', port='L'), route=dict(axis='x', value=300), lineNumber='L-101', lineService='Seal flush'),
        dict(id='n4', a=dict(node='n1', port='R'), b=dict(node='n2', port='L'), route=dict(waypoints=[dict(x=600, y=350)])),
    ], nextId=5, sealSvg=None, portModeVersion=3)
    load(group_fixture)
    def shift_select(index):
        b.js('''const n=document.querySelectorAll('#nodes>.node')[arguments[0]],p=new DOMPoint(0,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,shiftKey:true,clientX:p.x,clientY:p.y}));return true;''', [index])
    def select_pair():
        select(0)
        shift_select(1)
    select_pair()
    assert b.js("return document.querySelectorAll('#nodes>.node.selected').length") == 2
    assert b.js("return document.querySelector('#properties .info').textContent.includes('2 symbols selected')")
    roundtrip(lambda: b.js("document.querySelector('[data-align=\"x:start\"]').click();return true"), 'align group left edges')
    assert state()['nodes'][1]['x'] == 223
    select_pair()
    def move_group():
        b.js('''const n=document.querySelector('#nodes>.node'),svg=document.getElementById('drawing'),from=new DOMPoint(0,0).matrixTransform(n.getScreenCTM()),to=new DOMPoint(300,300).matrixTransform(svg.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:from.x,clientY:from.y}));for(let i=1;i<=4;i++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:from.x+(to.x-from.x)*i/4,clientY:from.y+(to.y-from.y)*i/4}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(move_group, 'move selected symbols as one edit')
    assert [(n['x'], n['y']) for n in state()['nodes']] == [(300, 300), (323, 480), (800, 550)]
    assert state()['pipes'][0]['route']['value'] == 400
    select_pair()
    roundtrip(lambda: b.js("document.querySelector('[data-align=\"y:center\"]').click();return true"), 'align group vertical centers')
    assert state()['nodes'][1]['y'] == 300
    select_pair()
    roundtrip(lambda: click('duplicateGroup'), 'duplicate group with internal pipes')
    copied = state()
    assert len(copied['nodes']) == 5 and len(copied['pipes']) == 3
    assert [(n['x'], n['y']) for n in copied['nodes'][-2:]] == [(345, 345), (368, 345)]
    assert copied['pipes'][-1]['a']['node'] == copied['nodes'][-2]['id']
    assert copied['pipes'][-1]['b']['node'] == copied['nodes'][-1]['id']
    assert copied['pipes'][-1]['route']['value'] == copied['pipes'][0]['route']['value'] + 45
    assert copied['pipes'][-1]['lineId'] != copied['pipes'][0]['id']
    assert copied['pipes'][-1]['lineNumber'] == 'L-101' and copied['pipes'][-1]['lineService'] == 'Seal flush'
    load(group_fixture)
    select(1)
    shift_select(2)
    roundtrip(lambda: click('duplicateGroup'), 'duplicate group with pipe waypoints')
    assert state()['pipes'][-1]['route']['waypoints'] == [dict(x=645, y=395)]
    load(group_fixture)
    select_pair()
    roundtrip(lambda: click('deleteSelected'), 'delete group and attached pipes')
    assert [n['id'] for n in state()['nodes']] == ['n2'] and not state()['pipes']
    load(group_fixture)
    b.js("window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true,cancelable:true}));return true")
    assert b.js("return document.querySelectorAll('#nodes>.node.selected').length") == 3
    shift_select(1)
    assert b.js("return document.querySelectorAll('#nodes>.node.selected').length") == 2
    line_fixture = dict(title='Line data', nodes=[
        dict(id='n0', kind='junction', x=200, y=400, w=44, h=44, tag='J1', notes='', ports=junction_ports),
        dict(id='n1', kind='junction', x=800, y=400, w=44, h=44, tag='J2', notes='', ports=junction_ports),
    ], pipes=[dict(id='n2', lineId='n2', a=dict(node='n0', port='R'), b=dict(node='n1', port='L'))], nextId=3, sealSvg=None, portModeVersion=3)
    load(line_fixture)
    def select_line():
        b.js("document.querySelector('[data-pipe]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true")
    select_line()
    roundtrip(lambda: edit('lineNumberEdit', ['L', 'L-1', 'L-101']), 'line number typing grouped into one edit')
    assert state()['pipes'][0]['lineNumber'] == 'L-101'
    assert b.js("return document.querySelector('#pipes .line-label').textContent") == 'L-101'
    for field, value in [('lineServiceEdit', 'Seal flush'), ('lineSizeEdit', 'DN25'), ('lineSpecEdit', 'SS-01')]:
        select_line()
        roundtrip(lambda field=field, value=value: edit(field, [value]), f'edit {field}')
    exported_line = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>{const doc=new DOMParser().parseFromString(markup,'image/svg+xml');done([doc.querySelector('#pipes .line-label')?.textContent,doc.querySelectorAll('#pipes .port').length])});return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_line == ['L-101', 0]
    roundtrip(lambda: drop_kind('isolation-valve', 500, 400), 'split line with data')
    assert len(state()['pipes']) == 2
    assert all(p['lineId'] == 'n2' and p['lineNumber'] == 'L-101' and p['lineService'] == 'Seal flush' and p['lineSize'] == 'DN25' and p['lineSpec'] == 'SS-01' for p in state()['pipes'])
    select_line()
    roundtrip(lambda: edit('lineSpecEdit', ['SS-02']), 'edit data across split line')
    assert all(p['lineSpec'] == 'SS-02' for p in state()['pipes'])
    assert b.js("return document.querySelectorAll('#pipes .line-label').length") == 2
    before_line_reload = state()
    b.call('WebDriver:Navigate', {'url': url})
    assert state() == before_line_reload
    load(empty_project)
    click('snapGrid')
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'true'
    assert b.js("return document.getElementById('undo').disabled")
    b.call('WebDriver:Navigate', {'url': url})
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'true'
    drop_symbol(123, 137)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (125, 125)
    drag_symbol(242, 263)
    assert (state()['nodes'][0]['x'], state()['nodes'][0]['y']) == (250, 275)
    drag_symbol(237, 258, True)
    assert near(state()['nodes'][0], 237, 258)
    click('duplicateSelected')
    assert (state()['nodes'][1]['x'], state()['nodes'][1]['y']) == (275, 300)
    ports = [dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0), dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)]
    air_fixture = dict(title='Off-grid pipe', nodes=[
        dict(id='n0', kind='PI', x=100, y=100, w=90, h=90, tag='PI', notes='', ports=[dict(id='L', x=-45, y=0), dict(id='R', x=45, y=0)]),
        dict(id='n1', kind='junction', x=200, y=413, w=44, h=44, tag='', notes='', ports=ports),
        dict(id='n2', kind='junction', x=800, y=413, w=44, h=44, tag='', notes='', ports=ports),
    ], pipes=[dict(id='n3', a=dict(node='n1', port='R'), b=dict(node='n2', port='L'))], nextId=4, sealSvg=None, portModeVersion=3)
    load(air_fixture)
    drag_symbol(450, 413)
    assert state()['nodes'][0]['y'] == 413 and len(state()['pipes']) == 2
    load(air_fixture)
    b.js('''const svg=document.getElementById('drawing'),p=new DOMPoint(450,413).matrixTransform(svg.getScreenCTM()),dt=new DataTransfer();dt.setData('text/plain','junction');document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,cancelable:true}));return true;''')
    assert len(state()['pipes']) == 2 and len(state()['nodes'][-1]['ports']) == 4
    load(empty_project)
    drop_symbol(123, 137, True)
    assert near(state()['nodes'][0], 123, 137)
    load(empty_project)
    click('snapGrid')
    assert b.js("return document.getElementById('snapGrid').getAttribute('aria-pressed')") == 'false'
    drop_symbol(123, 137)
    assert near(state()['nodes'][0], 123, 137)
    load(empty_project)
    print('PASS: optional 25-unit symbol snapping, Alt bypass, and saved preference', flush=True)
    add('circulating-pump')
    assert state()['nodes'][0]['ports'] == []
    def add_equipment_port():
        select(0)
        click('addPortHere')
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(0,-20).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''')
    roundtrip(add_equipment_port, 'add manual equipment port')
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    click('undo')
    click('undo')
    roundtrip(lambda: add('PI'), 'add symbol / redo')
    assert state()['nodes'][0]['ports'] == []
    def add_instrument_port():
        select(0)
        click('addPortHere')
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(45,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''')
    roundtrip(add_instrument_port, 'add manual instrument port')
    assert [port['id'] for port in state()['nodes'][0]['ports']] == ['P1']
    roundtrip(lambda: b.js('document.querySelector("[data-port=P1]").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,altKey:true}));return true'), 'remove manual instrument port')
    select(0)
    roundtrip(lambda: edit('tagEdit', ['P', 'PI-', 'PI-101']), 'caption typing grouped into one edit')
    select(0)
    roundtrip(lambda: edit('notesEdit', ['N', 'Notes', 'Notes for PI']), 'notes typing grouped into one edit')
    b.js('document.activeElement.blur();return true')
    b.js('document.getElementById("drawing").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    roundtrip(lambda: edit('titleEdit', ['S', 'Seal', 'Seal support loop']), 'drawing title typing grouped into one edit')
    select(0)
    for element_id in ['rotateRight', 'mirrorHorizontal', 'mirrorVertical', 'resetTransform', 'duplicateSelected']:
        select(0)
        roundtrip(lambda element_id=element_id: click(element_id), element_id)
    select(0)
    roundtrip(lambda: b.js('const i=document.getElementById("symbolScale");i.value=150;i.dispatchEvent(new Event("change"));return true'), 'resize')

    def move():
        b.js('''const n=document.querySelector('#nodes>.node'),p=new DOMPoint(0,0).matrixTransform(n.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));for(let i=1;i<=5;i++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x+i*20,clientY:p.y+i*10}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(move, 'multi-move drag is one edit')

    nodes = [dict(id=f'n{i}', kind='junction', x=250+i*800, y=400, w=44, h=44,
                  tag='', notes='', ports=[dict(id='L', x=-22, y=0), dict(id='R', x=22, y=0),
                                          dict(id='T', x=0, y=-22), dict(id='B', x=0, y=22)])
             for i in range(2)]
    fixture = dict(title='History fixture', nodes=nodes, pipes=[], nextId=10, sealSvg=None, portModeVersion=3)
    load(fixture)
    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")

    def connect():
        b.js('''for(const ref of [[0,'R'],[1,'L']]){const n=document.querySelectorAll('#nodes>.node')[ref[0]],p=n.querySelector('[data-port='+ref[1]+']'),q=new DOMPoint(0,0).matrixTransform(p.getScreenCTM());p.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:q.x,clientY:q.y}));}return true;''')
    roundtrip(connect, 'connect ports')

    def select_pipe():
        b.js("document.querySelector('[data-pipe]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));return true")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-color=orange]').click();return true"), 'line color')
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") is None
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-service=instrument-air]').click();return true"), 'dashed instrument air')
    assert state()['pipes'][0]['service'] == 'instrument-air'
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") == '9 6'
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-service=process]').click();return true"), 'restore solid pipe')
    assert 'service' not in state()['pipes'][0]
    assert b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('stroke-dasharray')") is None
    select_pipe()
    b.js("document.querySelector('[data-pipe-service=instrument-air]').click();return true")
    exported_dash = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>done(new DOMParser().parseFromString(markup,'image/svg+xml').querySelector('#pipes .wire')?.getAttribute('stroke-dasharray')));return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_dash == '9 6'
    assert not b.js("return !!document.querySelector('#pipes .flow-arrow')")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=forward]').click();return true"), 'forward flow direction')
    assert state()['pipes'][0]['direction'] == 'forward'
    assert b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('fill')") == '#ea580c'
    forward_arrow = b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('d')")
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=reverse]').click();return true"), 'reverse flow direction')
    reverse_arrow = b.js("return document.querySelector('#pipes .flow-arrow').getAttribute('d')")
    assert reverse_arrow != forward_arrow
    select_pipe()
    roundtrip(lambda: b.js("document.querySelector('[data-pipe-direction=none]').click();return true"), 'clear flow direction')
    assert 'direction' not in state()['pipes'][0]
    assert not b.js("return !!document.querySelector('#pipes .flow-arrow')")
    select_pipe()
    b.js("document.querySelector('[data-pipe-direction=forward]').click();return true")
    for element_id in ['routeHorizontal', 'routeVertical']:
        select_pipe()
        roundtrip(lambda element_id=element_id: click(element_id), element_id)

    def route_drag():
        select_pipe()
        b.js('''const h=document.querySelector('.bend-handle circle'),p=new DOMPoint(Number(h.getAttribute('cx')),Number(h.getAttribute('cy'))).matrixTransform(document.getElementById('drawing').getScreenCTM());h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));for(let i=1;i<=4;i++)window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x+i*20,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(route_drag, 'bend drag grouped into one edit')
    select_pipe()
    roundtrip(lambda: click('routeCenter'), 'recenter route')
    select_pipe()
    roundtrip(lambda: click('routeAdd'), 'add first pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 1
    select_pipe()
    roundtrip(lambda: click('routeAdd'), 'add second pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 2

    def move_waypoint():
        select_pipe()
        b.js('''const h=document.querySelector('.waypoint-handle circle'),svg=document.getElementById('drawing'),p=new DOMPoint(Number(h.getAttribute('cx')),Number(h.getAttribute('cy'))).matrixTransform(svg.getScreenCTM());h.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:p.x,clientY:p.y-80}));window.dispatchEvent(new PointerEvent('pointerup'));return true;''')
    roundtrip(move_waypoint, 'waypoint drag grouped into one edit')
    assert state()['pipes'][0]['route']['waypoints'][0]['y'] < 400
    assert b.js('''const points=document.querySelector('#pipes .wire:not(.hit)').getAttribute('d').match(/-?\\d+(?:\\.\\d+)?/g).map(Number);for(let i=2;i<points.length;i+=2)if(points[i]!==points[i-2]&&points[i+1]!==points[i-1])return false;return true;''')
    visible_route = b.js("return document.querySelector('#pipes .wire:not(.hit)').getAttribute('d')")
    exported_route = b.async_js('''const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>{const doc=new DOMParser().parseFromString(markup,'image/svg+xml');done([doc.querySelector('#pipes .wire').getAttribute('d'),doc.querySelectorAll('.waypoint-handle').length])});return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;''')
    assert exported_route == [visible_route, 0]

    def remove_waypoint():
        select_pipe()
        b.js("document.querySelector('[data-waypoint=\"1\"] circle').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,altKey:true}));return true")
    roundtrip(remove_waypoint, 'remove a pipe waypoint')
    assert len(state()['pipes'][0]['route']['waypoints']) == 1
    before_move = state()
    move()
    assert state()['pipes'][0]['route']['waypoints'] == before_move['pipes'][0]['route']['waypoints']
    click('undo')
    assert state() == before_move
    select(0)
    roundtrip(lambda: click('deleteSelected'), 'delete symbol restores its connected pipes')
    click('undo')
    select_pipe()
    roundtrip(lambda: click('deleteSelected'), 'delete pipe')
    click('undo')

    def insert():
        b.js('''const dt=new DataTransfer();document.querySelector('[data-kind=PI]').dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt}));const p=new DOMPoint(450,400).matrixTransform(document.getElementById('drawing').getScreenCTM());document.getElementById('canvasWrap').dispatchEvent(new DragEvent('drop',{clientX:p.x,clientY:p.y,dataTransfer:dt,cancelable:true}));return true;''')
    roundtrip(insert, 'palette insertion is one edit including colored, directed, dashed connections')
    assert len(state()['pipes']) == 2 and all(p['color'] == 'orange' and p['direction'] == 'forward' and p['service'] == 'instrument-air' for p in state()['pipes'])
    assert any(p['route'].get('waypoints') for p in state()['pipes'])

    # Move an existing unconnected instrument into the remaining line section.
    add('TI')
    instrument_index = len(state()['nodes']) - 1
    def insert_existing():
        line_y = state()['pipes'][1]['route']['waypoints'][-1]['y']
        b.js("""const n=document.querySelectorAll('#nodes>.node')[arguments[0]],svg=document.getElementById('drawing'),from=new DOMPoint(0,0).matrixTransform(n.getScreenCTM()),to=new DOMPoint(900,arguments[1]).matrixTransform(svg.getScreenCTM());n.querySelector('.symbol-artwork').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:from.x,clientY:from.y}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:to.x,clientY:to.y}));window.dispatchEvent(new PointerEvent('pointerup'));return true;""", [instrument_index, line_y])
    roundtrip(insert_existing, 'existing instrument insertion is one edit')
    assert len(state()['pipes']) == 3

    roundtrip(lambda: add('dual-seal-bb-w-plug'), 'add seal')
    seal_index = len(state()['nodes']) - 1
    assert state()['nodes'][seal_index]['ports'] == []

    def add_port():
        select(seal_index)
        click('addPortHere')
        b.js('''const n=document.querySelectorAll('#nodes>.node')[arguments[0]],p=new DOMPoint(20,30).matrixTransform(n.getScreenCTM());n.querySelector('image').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y}));return true;''', [seal_index])
    roundtrip(add_port, 'add custom seal port')
    roundtrip(lambda: b.js('document.querySelector("[data-port=P1]").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,altKey:true}));return true'), 'remove custom seal port')

    def import_svg():
        b.async_js('''const done=arguments[arguments.length-1],input=document.getElementById('sealFile'),dt=new DataTransfer();dt.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50"/></svg>'],'custom.svg',{type:'image/svg+xml'}));input.files=dt.files;input.onchange({target:input}).then(()=>done(true));''')
    select(seal_index)
    roundtrip(import_svg, 'replace imported SVG')
    b.js('document.getElementById("drawing").dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    roundtrip(import_svg, 'import new SVG is one edit')

    # Branching history clears redo. Selection, pan, and zoom do not create edits.
    click('undo')
    assert not b.js("return document.getElementById('redo').disabled")
    add('TI')
    assert b.js("return document.getElementById('redo').disabled")
    expected = state()
    select(0)
    b.js('const svg=document.getElementById("drawing");svg.dispatchEvent(new PointerEvent("pointerdown",{bubbles:true,clientX:300,clientY:200}));window.dispatchEvent(new PointerEvent("pointermove",{clientX:320,clientY:210}));window.dispatchEvent(new PointerEvent("pointerup"));return true')
    click('zoomIn')
    click('zoomOut')
    assert state() == expected
    click('undo')
    assert len(state()['nodes']) == len(expected['nodes']) - 1
    click('redo')
    assert state() == expected
    print('PASS: redo invalidation and no history entries for selection / pan / zoom')

    # Shortcuts work outside text inputs and leave focused inputs to the browser.
    before = state()
    b.js('document.activeElement.blur();window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() != before
    b.js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",metaKey:true,shiftKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    b.js('window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));window.dispatchEvent(new KeyboardEvent("keydown",{key:"y",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    b.js('document.getElementById("titleEdit").focus();window.dispatchEvent(new KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true,cancelable:true}));return true')
    assert state() == before
    print('PASS: Ctrl/Cmd shortcuts and native text-field shortcut protection')

    b.call('WebDriver:Navigate', {'url': url})
    assert state() == before
    assert b.js("return document.getElementById('undo').disabled&&document.getElementById('redo').disabled")
    add('PT')
    b.js('window.confirm=()=>true;document.getElementById("newProject").click();return true')
    assert not state()['nodes'] and b.js("return document.getElementById('undo').disabled")
    # Cap session history without breaking nextId restoration.
    b.js('for(let i=0;i<105;i++)document.querySelector("[data-kind=PI]").click();return true')
    b.js('for(let i=0;i<100;i++)document.getElementById("undo").click();return true')
    assert len(state()['nodes']) == 5 and b.js("return document.getElementById('undo').disabled")
    b.js('for(let i=0;i<100;i++)document.getElementById("redo").click();return true')
    assert len(state()['nodes']) == 105 and b.js("return document.getElementById('redo').disabled")
    print('PASS: reload / new / open history reset, autosave, and 100-edit history limit')


def run_editing_tests(browser):
    """Pipe tool, automatic routing, area selection, and keyboard editing."""
    b = browser
    url = (ROOT / 'PID-Builder.html').as_uri()
    b.call('WebDriver:Navigate', {'url': url})
    b.js('localStorage.clear();return true')
    b.call('WebDriver:Navigate', {'url': url})

    def state():
        return b.js(f"return JSON.parse(localStorage.getItem('{STORAGE}'))")

    def load(project):
        b.async_js("""const done=arguments[arguments.length-1],input=document.getElementById('projectFile'),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(arguments[0])],'test.json',{type:'application/json'}));input.files=dt.files;input.onchange({target:input}).then(()=>done(true));""", [project])

    def click(element_id):
        b.js('document.getElementById(arguments[0]).click();return true', [element_id])

    def key(name, **modifiers):
        b.js('window.dispatchEvent(new KeyboardEvent("keydown",Object.assign({key:arguments[0],bubbles:true,cancelable:true},arguments[1])));return true', [name, modifiers])

    # Dispatches real pointer gestures at drawing coordinates, on whatever element is there.
    POINTER = """const svg=document.getElementById('drawing'),at=(x,y)=>new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
        const fire=(type,x,y,target,extra)=>{const p=at(x,y);(target||document.elementFromPoint(p.x,p.y)).dispatchEvent(new PointerEvent(type,Object.assign({bubbles:true,clientX:p.x,clientY:p.y},extra||{})))};"""

    def press(x, y, **modifiers):
        b.js(POINTER + "fire('pointerdown',arguments[0],arguments[1],null,arguments[2]);fire('pointerup',arguments[0],arguments[1],window);return true", [x, y, modifiers])

    def drag(x1, y1, x2, y2, **modifiers):
        b.js(POINTER + """fire('pointerdown',arguments[0],arguments[1],null,arguments[4]);fire('pointermove',(arguments[0]+arguments[2])/2,(arguments[1]+arguments[3])/2,window,arguments[4]);
            fire('pointermove',arguments[2],arguments[3],window,arguments[4]);fire('pointerup',arguments[2],arguments[3],window);return true""", [x1, y1, x2, y2, modifiers])

    def wire_points(index=0):
        return b.js("""const d=document.querySelectorAll('#pipes .wire:not(.hit)')[arguments[0]].getAttribute('d').match(/-?\\d+(?:\\.\\d+)?/g).map(Number),points=[];
            for(let i=0;i<d.length;i+=2)points.push([d[i],d[i+1]]);return points""", [index])

    def crosses(points, left, top, right, bottom):
        for (x1, y1), (x2, y2) in zip(points, points[1:]):
            if max(x1, x2) > left and min(x1, x2) < right and max(y1, y2) > top and min(y1, y2) < bottom:
                return True
        return False

    def tanks():
        return dict(title='Pipe tool', nodes=[
            dict(id='n0', kind='nitrogen', x=300, y=450, w=170, h=215, tag='A', notes='', ports=[]),
            dict(id='n1', kind='nitrogen', x=1100, y=450, w=170, h=215, tag='B', notes='', ports=[]),
        ], pipes=[], nextId=2, sealSvg=None, portModeVersion=3)

    load(tanks())
    click('toolPipe')
    press(380, 450)
    assert len(state()['nodes'][0]['ports']) == 1 and not state()['pipes']
    press(1020, 450)
    drawing = state()
    assert len(drawing['pipes']) == 1 and len(drawing['nodes'][1]['ports']) == 1
    assert drawing['pipes'][0]['a'] == dict(node='n0', port='P1') and drawing['pipes'][0]['b'] == dict(node='n1', port='P1')
    assert b.js("return document.getElementById('toolPipe').getAttribute('aria-pressed')") == 'true'
    click('undo')
    assert not state()['pipes'] and not state()['nodes'][1]['ports'] and len(state()['nodes'][0]['ports']) == 1
    click('redo')
    assert state() == drawing
    key('Escape')
    assert b.js("return document.getElementById('toolSelect').getAttribute('aria-pressed')") == 'true'
    print('PASS: pipe tool creates ports and a pipe from two clicks', flush=True)

    # Pressing an existing port and releasing over another symbol connects in one gesture.
    load(dict(tanks(), nodes=[dict(tanks()['nodes'][0], ports=[dict(id='P1', x=85, y=0, custom=True)]), tanks()['nodes'][1]]))
    drag(385, 450, 1060, 480)
    assert len(state()['pipes']) == 1 and len(state()['nodes'][1]['ports']) == 1
    # A plain click on a port still leaves the connection pending for a second click.
    load(dict(tanks(), nodes=[dict(tanks()['nodes'][0], ports=[dict(id='P1', x=85, y=0, custom=True)]), dict(tanks()['nodes'][1], ports=[dict(id='P1', x=-85, y=0, custom=True)])]))
    press(385, 450)
    assert not state()['pipes'] and b.js("return !!document.querySelector('.port.pending')")
    press(1015, 450)
    assert len(state()['pipes']) == 1 and all(len(n['ports']) == 1 for n in state()['nodes'])
    print('PASS: drag from a port to a symbol, and click-click between ports', flush=True)

    # Clicking a pipe with the pipe tool tees into it with a junction, at either end of the new pipe.
    def tee_fixture():
        return dict(title='Tee', nodes=[
            dict(id='n0', kind='nitrogen', x=200, y=300, w=170, h=215, tag='A', notes='', ports=[dict(id='P1', x=85, y=0, custom=True)]),
            dict(id='n1', kind='nitrogen', x=1200, y=300, w=170, h=215, tag='B', notes='', ports=[dict(id='P1', x=-85, y=0, custom=True)]),
            dict(id='n2', kind='nitrogen', x=700, y=700, w=170, h=215, tag='C', notes='', ports=[]),
        ], pipes=[dict(id='n3', lineId='n3', a=dict(node='n0', port='P1'), b=dict(node='n1', port='P1'), color='red', lineNumber='L-1')], nextId=4, sealSvg=None, portModeVersion=3)
    load(tee_fixture())
    click('toolPipe')
    press(700, 300)
    drawing = state()
    junction = drawing['nodes'][-1]
    assert junction['kind'] == 'junction' and (junction['x'], junction['y']) == (700, 300) and len(drawing['pipes']) == 2
    assert all(p['color'] == 'red' and p['lineNumber'] == 'L-1' and p['lineId'] == 'n3' for p in drawing['pipes'])
    press(700, 620)
    drawing = state()
    assert len(drawing['pipes']) == 3 and drawing['pipes'][-1]['a'] == dict(node=junction['id'], port='B')
    assert drawing['pipes'][-1]['b']['node'] == 'n2' and 'branch' not in drawing['pipes'][-1]['a']
    arms = b.js("return document.querySelector(`[data-node='${arguments[0]}'] .symbol-artwork path`).getAttribute('d')", [junction['id']])
    assert 'V 22' in arms and 'V -22' not in arms and 'H 22' in arms and 'H -22' in arms
    click('undo')
    assert len(state()['pipes']) == 2 and len(state()['nodes']) == 4
    click('undo')
    assert len(state()['pipes']) == 1 and len(state()['nodes']) == 3
    # Ending on a pipe: one undo step for the junction and the new pipe together.
    key('Escape')
    load(dict(tee_fixture(), nodes=[tee_fixture()['nodes'][0], tee_fixture()['nodes'][1], dict(tee_fixture()['nodes'][2], y=-100)]))
    before = state()
    click('toolPipe')
    press(700, -20)
    started = state()
    press(900, 300)
    drawing = state()
    junction = drawing['nodes'][-1]
    assert len(drawing['pipes']) == 3 and (junction['x'], junction['y']) == (900, 300)
    assert drawing['pipes'][-1]['b'] == dict(node=junction['id'], port='T')
    click('undo')
    assert state() == started
    # A second branch from the same junction takes its remaining free side.
    click('redo')
    press(900, 300)
    press(1200, 395)
    key('Escape')
    assert len(state()['pipes']) == 4 and state()['pipes'][-1]['a'] == dict(node=junction['id'], port='B')
    assert state()['pipes'][-1]['b']['node'] == 'n1'
    # Too short a run to hold a junction leaves the drawing alone.
    load(dict(tee_fixture(), nodes=[tee_fixture()['nodes'][0], dict(tee_fixture()['nodes'][1], x=420), tee_fixture()['nodes'][2]]))
    before = state()
    click('toolPipe')
    press(310, 300)
    assert state() == before
    key('Escape')
    print('PASS: pipe tool tees into an existing pipe at either end', flush=True)

    # Automatic routes leave ports outward and go around symbols in the way.
    obstacle = dict(title='Routing', nodes=[
        dict(id='n0', kind='nitrogen', x=300, y=450, w=170, h=215, tag='A', notes='', ports=[dict(id='P1', x=85, y=0, custom=True)]),
        dict(id='n1', kind='nitrogen', x=1100, y=450, w=170, h=215, tag='B', notes='', ports=[dict(id='P1', x=-85, y=0, custom=True)]),
        dict(id='n2', kind='cooler', x=700, y=450, w=190, h=150, tag='IN THE WAY', notes='', ports=[]),
    ], pipes=[dict(id='n3', lineId='n3', a=dict(node='n0', port='P1'), b=dict(node='n1', port='P1'))], nextId=4, sealSvg=None, portModeVersion=3)
    load(obstacle)
    points = wire_points()
    assert points[0] == [385, 450] and points[-1] == [1015, 450]
    assert all(x1 == x2 or y1 == y2 for (x1, y1), (x2, y2) in zip(points, points[1:]))
    assert not crosses(points, 605, 375, 795, 525), points
    assert points[1][0] > points[0][0] and points[-2][0] < points[-1][0]
    # A port facing away from its target leaves outward first and goes around its own symbol.
    away = dict(obstacle, nodes=[dict(obstacle['nodes'][0], ports=[dict(id='P1', x=-85, y=0, custom=True)]), obstacle['nodes'][1]])
    load(away)
    points = wire_points()
    assert points[1][0] < points[0][0], points
    assert not crosses(points, 217, 345, 383, 555), points
    # An explicit route is kept until Automatic is chosen again.
    load(dict(obstacle, pipes=[dict(obstacle['pipes'][0], route=dict(axis='x', value=500))]))
    assert crosses(wire_points(), 605, 375, 795, 525)
    b.js(POINTER + "fire('pointerdown',450,450,document.querySelector('[data-pipe]'));fire('pointerup',450,450,window);return true")
    click('routeAuto')
    assert 'route' not in state()['pipes'][0] and not crosses(wire_points(), 605, 375, 795, 525)
    click('undo')
    assert state()['pipes'][0]['route'] == dict(axis='x', value=500)
    print('PASS: automatic routes avoid symbols and respect port sides', flush=True)

    # Dragging a corner of an automatic route freezes its bends as waypoints.
    load(obstacle)
    b.js(POINTER + "fire('pointerdown',450,450,document.querySelector('[data-pipe]'));fire('pointerup',450,450,window);return true")
    corners = b.js("return document.querySelectorAll('[data-auto-corner]').length")
    assert corners >= 2
    b.js(POINTER + """const handle=document.querySelector('[data-auto-corner="0"] circle'),x=+handle.getAttribute('cx'),y=+handle.getAttribute('cy');
        fire('pointerdown',x,y,handle);fire('pointermove',x+40,y,window);fire('pointerup',x+40,y,window);return true""")
    assert len(state()['pipes'][0]['route']['waypoints']) == corners
    click('undo')
    assert 'route' not in state()['pipes'][0]
    print('PASS: dragging an automatic corner converts the route to waypoints', flush=True)

    # Shift-drag on blank sheet selects every symbol the rectangle touches.
    load(obstacle)
    before = state()
    drag(150, 250, 800, 650, shiftKey=True)
    assert b.js("return [...document.querySelectorAll('.node.selected')].map(n=>n.dataset.node)") == ['n0', 'n2']
    assert state() == before and b.js("return document.getElementById('undo').disabled")
    # Arrow keys nudge the selection; a run of nudges is one undo step.
    for _ in range(3):
        key('ArrowRight')
    key('ArrowDown', shiftKey=True)
    moved = state()
    assert [(n['x'], n['y']) for n in moved['nodes']] == [(303, 475), (1100, 450), (703, 475)]
    click('undo')
    assert state() == before
    click('redo')
    assert state() == moved
    drag(150, 250, 800, 650, shiftKey=True)
    key('d', ctrlKey=True)
    assert len(state()['nodes']) == 5
    key('Escape')
    press(300, 450)
    key('r')
    assert [n.get('rotation') for n in state()['nodes']].count(90) == 1
    print('PASS: area selection, arrow-key nudging, Ctrl+D, and R to rotate', flush=True)

    # Zoom to fit shows the whole drawing; the default swatch clears a line colour.
    far = dict(obstacle, nodes=[obstacle['nodes'][0], dict(obstacle['nodes'][1], x=3200, y=1900), obstacle['nodes'][2]])
    load(far)
    click('zoomFit')
    x, y, w, h = b.js("return document.getElementById('drawing').getAttribute('viewBox').split(' ').map(Number)")
    assert x < 215 and y < 342 and x + w > 3285 and y + h > 2008
    b.js(POINTER + "const wire=document.querySelector('[data-pipe]');wire.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));fire('pointerup',0,0,window);return true")
    b.js("document.querySelector('[data-pipe-color=red]').click();return true")
    assert state()['pipes'][0]['color'] == 'red'
    b.js("document.querySelector('[data-pipe-color=default]').click();return true")
    assert 'color' not in state()['pipes'][0]
    print('PASS: zoom to fit and default line colour', flush=True)

    # An inline symbol can be pulled out of its line with Alt-drag, or deleted; the line heals.
    line = dict(title='Inline', nodes=[
        dict(id='n0', kind='PI', x=200, y=400, w=90, h=90, tag='A', notes='', ports=[dict(id='P1', x=45, y=0, custom=True)]),
        dict(id='n1', kind='PI', x=1100, y=400, w=90, h=90, tag='B', notes='', ports=[dict(id='P1', x=-45, y=0, custom=True)]),
    ], pipes=[dict(id='n2', lineId='n2', a=dict(node='n0', port='P1'), b=dict(node='n1', port='P1'), color='red', direction='forward', lineNumber='L-7')], nextId=3, sealSvg=None, portModeVersion=3)

    def drop_valve():
        load(line)
        b.js('document.querySelector(`[data-kind="isolation-valve"]`).click();return true')
        drag(750, 450, 650, 400)
        assert len(state()['pipes']) == 2 and len(state()['nodes'][2]['ports']) == 2
        return state()

    def healed(pipes):
        assert len(pipes) == 1
        pipe = pipes[0]
        assert (pipe['a'], pipe['b']) == (dict(node='n0', port='P1'), dict(node='n1', port='P1'))
        assert (pipe['color'], pipe['direction'], pipe['lineNumber']) == ('red', 'forward', 'L-7')
        assert wire_points() == [[245, 400], [1055, 400]]

    inline = drop_valve()
    drag(650, 400, 650, 600, altKey=True)
    after = state()
    healed(after['pipes'])
    assert after['nodes'][2]['ports'] == [] and after['nodes'][2]['y'] == 600 and len(after['nodes']) == 3
    click('undo')
    assert state() == inline, 'pulling a symbol out of a line is one undo step'
    drag(650, 400, 700, 400)
    assert len(state()['pipes']) == 2, 'a plain drag keeps the symbol in its line'
    drop_valve()
    key('Delete')
    healed(state()['pipes'])
    assert len(state()['nodes']) == 2
    print('PASS: Alt-drag and Delete take an inline symbol out of its line', flush=True)

    # Instruments are numbered per type as they are placed; the number shows in the bubble.
    def type_into(element_id, value):
        b.js("const el=document.getElementById(arguments[0]);el.value=arguments[1];el.dispatchEvent(new Event('input',{bubbles:true}));return true", [element_id, value])

    def numbers():
        return [(n['kind'], n.get('number')) for n in state()['nodes']]

    load(dict(title='Old drawing', nodes=[dict(id='n0', kind='PI', x=300, y=300, w=90, h=90, tag='PI', notes='', ports=[])], pipes=[], nextId=1, sealSvg=None, portModeVersion=3))
    assert numbers() == [('PI', None)] and not b.js("return !!document.querySelector('.tag-number')")
    assert not b.js("return !!document.querySelector('.sheet-frame')"), 'a drawing saved without sheet data has no frame'
    load(dict(title='Numbered', nodes=[], pipes=[], nextId=1, sealSvg=None, portModeVersion=3))
    for kind in ['PI', 'PI', 'TT']:
        b.js('document.querySelector(`[data-kind="${arguments[0]}"]`).click();return true', [kind])
    assert numbers() == [('PI', '101'), ('PI', '102'), ('TT', '101')]
    assert b.js("return [...document.querySelectorAll('.tag-number')].map(t=>t.textContent)") == ['101', '102', '101']
    type_into('numberEdit', '2')
    type_into('numberEdit', '205')
    assert numbers()[2] == ('TT', '205') and b.js("return document.getElementById('tagPreview').textContent") == 'TT-205'
    click('undo')
    assert numbers()[2] == ('TT', '101'), 'typing a tag number is one undo step'
    click('redo')
    b.js("document.querySelector('[data-kind=TT]').click();return true")
    key('d', ctrlKey=True)
    assert numbers()[3:] == [('TT', '206'), ('TT', '207')], 'new and duplicated instruments take the next free number'
    type_into('numberEdit', '')
    assert numbers()[4] == ('TT', '') and len(b.js("return [...document.querySelectorAll('.tag-number')].map(t=>t.textContent)")) == 4
    print('PASS: instrument tag numbers', flush=True)

    # A new drawing has a frame and title block, shown on the sheet and exported with it.
    load(dict(title='Blank', nodes=[], pipes=[], nextId=1, sealSvg=None, portModeVersion=3))
    click('newProject')
    assert state()['sheet']['frame'] is True and b.js("return !!document.querySelector('.sheet-frame')")
    type_into('titleEdit', 'Plan 53B loop')
    type_into('sheetNumber', 'SL-001')
    type_into('sheetRevision', 'B')
    type_into('sheetAuthor', 'A very long name that cannot fit in its cell')
    block = b.js("return Object.fromEntries([...document.querySelectorAll('.title-block [data-sheet]')].map(t=>[t.dataset.sheet,t.textContent]))")
    assert block['title'] == 'Plan 53B loop' and block['number'] == 'SL-001' and block['revision'] == 'B' and block['date'] == ''
    assert block['author'].endswith('…') and len(block['author']) < 20
    assert state()['sheet'] == dict(frame=True, number='SL-001', revision='B', date='', author='A very long name that cannot fit in its cell')
    exported = b.async_js("""const done=arguments[arguments.length-1],original=URL.createObjectURL;URL.createObjectURL=function(blob){blob.text().then(markup=>{const doc=new DOMParser().parseFromString(markup,'image/svg+xml'),f=doc.querySelector('.sheet-frame');
        done({view:doc.documentElement.getAttribute('viewBox'),frame:['x','y','width','height'].map(k=>+f.getAttribute(k)),number:doc.querySelector('[data-sheet=number]').textContent,editor:doc.querySelectorAll('.editor-only').length})});return original.call(this,blob)};document.getElementById('exportSVG').click();URL.createObjectURL=original;""")
    assert exported == dict(view='0 0 1500 900', frame=[12, 12, 1476, 876], number='SL-001', editor=0)
    # A symbol in the title block's corner makes the sheet taller instead of being covered.
    b.js("document.querySelector('[data-kind=reservoir]').click();return true")
    drag(750, 450, 1300, 780)
    frame = b.js("const f=document.querySelector('.sheet-frame'),t=document.querySelector('.title-block rect');return {bottom:+f.getAttribute('y')+ +f.getAttribute('height'),block:+t.getAttribute('y')}")
    node = state()['nodes'][0]
    assert frame['block'] > node['y'] + node['h'] / 2, 'title block clears the symbol'
    press(200, 200)  # deselect, so Properties shows the drawing
    click('sheetFrameToggle')
    assert state()['sheet']['frame'] is False and not b.js("return !!document.querySelector('.sheet-frame')")
    click('undo')
    assert state()['sheet']['frame'] is True and b.js("return !!document.querySelector('.sheet-frame')")
    print('PASS: frame and title block on the sheet and in exports', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Connect to an existing temporary Firefox')
    parser.add_argument('--only-editing', action='store_true', help='Skip the undo/redo suite and run only the editing-tool tests')
    args = parser.parse_args()
    process = None
    b = None
    with tempfile.TemporaryDirectory(prefix='pid-history-') as profile:
        try:
            port = args.port
            if port is None:
                firefox = shutil.which('firefox')
                if not firefox:
                    raise RuntimeError('Firefox is required to run this test')
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    port = sock.getsockname()[1]
                Path(profile, 'user.js').write_text(f'user_pref("marionette.port", {port});\n')
                process = subprocess.Popen([firefox, '--headless', '--marionette', '--no-remote', '--profile', profile],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + 20
            while True:
                try:
                    b = Browser(port)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(.2)
            b.call('WebDriver:NewSession')
            b.call('WebDriver:SetWindowRect', {'width': 1440, 'height': 1000})
            if not args.only_editing:
                run_tests(b)
            run_editing_tests(b)
        finally:
            if b:
                try:
                    b.call('WebDriver:DeleteSession')
                finally:
                    b.socket.close()
            if process:
                process.terminate()
                process.wait(timeout=10)


if __name__ == '__main__':
    main()
