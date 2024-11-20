/* 

IBM Carbon to DB Library converter

*/

import { parse } from "yaml";
import {readFileSync, outputFileSync} from 'fs-extra'
import {globSync} from 'glob'
import { optimize } from 'svgo';
import { Resvg } from '@resvg/resvg-js'
import cliProgress from 'cli-progress'
import chalk from 'chalk'

import blacklist from "./blacklist";

// INTERNAL TYPES

interface RegisteryEntry {
   friendlyName: string
   aliases: string[]
   category: string
   topCategory: string
   svg: string
}

type Registry = Record<string, RegisteryEntry>

interface CategoryMapEntry {
  name: string
  topCategory: string
}

type CategoryMap = Record<string, CategoryMapEntry>

interface IconMapEntry {
  friendlyName: string
  aliases: string[]
}

type IconMap = Record<string, IconMapEntry>

// IBM CARBON YAML SCHEMA

interface Categories {
  categories: Category[];
}

interface Category {
  name:          string;
  subcategories: Subcategory[];
}

interface Subcategory {
  name:    string;
  members: string[];
}

interface Icons {
  name:          string;
  friendly_name: string;
  aliases:       string[];
  sizes:         number[]
}

const ICONS = parse(readFileSync('./carbon-assets/icons.yml', 'utf-8')) as Icons[]
const CATEGORIES = parse(readFileSync('./carbon-assets/categories.yml', 'utf-8')) as Categories
const SVGS = globSync('./carbon-assets/32/**/*.svg', {withFileTypes: true})

const REGISTERY: Registry = {}
const CATEGORYMAP: CategoryMap = {}
const ICONMAP: IconMap = {}

CATEGORIES.categories.forEach(category => {
  category.subcategories.forEach(subcategory => {
    subcategory.members.forEach(member => {
      CATEGORYMAP[member] = {
        name: subcategory.name,
        topCategory: category.name
      }
    })
  })
})

ICONS.forEach(icon => {
  ICONMAP[icon.name] = {
    friendlyName: icon.friendly_name,
    aliases: icon.aliases
  }
})

SVGS.forEach(svg => {
  const name = svg.name.slice(0, -'.svg'.length);
  const iconEntry = ICONMAP[name]
  const categoryEntry = CATEGORYMAP[name]

  // Search in blacklist
  if (blacklist.includes(name)) return

  REGISTERY[name] = {
    friendlyName: iconEntry.friendlyName,
    aliases: iconEntry.aliases,
    category: categoryEntry.name,
    topCategory: categoryEntry.topCategory,
    svg: readFileSync(`./${svg.relative()}`, 'utf-8')
  }
})

function colorizePlugin(color: string) {
  return {
    name: 'colorizeTo-' + color,
    fn: () => {
      return {
        element: {
          enter: (node, _parentNode) => {
            if (node.attributes.fill == 'none') {
              return;
            }
  
            node.attributes.fill = color;
          },
        },
      };
    }
  }
}

function toSvg(svg: string) {
  const resvg = new Resvg(svg, {
    fitTo: {mode: 'width', value: 1024}
  })
  return resvg.render().asPng()
}

const chalkSignature = chalk.hex('"002346');

console.log(`${chalk.bold('IBM Carbon to DB Library converter')}${chalk.reset()}\n`)

const progress = new cliProgress.SingleBar({
  format: `${chalkSignature.bgWhiteBright('{bar}')} | {percentage}% || {value}/{total} icons || ETA: {eta}s | ${chalk.bold.hex('#002346')('{category} / {name}')} `,
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

progress.start(Object.keys(REGISTERY).length, 0, {
  speed: "N/A"
});


for (const key in REGISTERY) {
 const entry = REGISTERY[key]

 progress.increment()
 progress.update({category: entry.category, name: entry.friendlyName})

 const signature = optimize(entry.svg, {
  plugins: [colorizePlugin('#002346'), 'preset-default']
 }).data
 const white = optimize(entry.svg, {
  plugins: [colorizePlugin('#fff'), 'preset-default']
 }).data

outputFileSync(`./output/svg-32/Signature/${entry.category}/${entry.friendlyName}.svg`, signature)
outputFileSync(`./output/svg-32/White/${entry.category}/${entry.friendlyName}.svg`, white)
outputFileSync(`./output/png-1024/Signature/${entry.category}/${entry.friendlyName}.png`, toSvg(signature))
outputFileSync(`./output/png-1024/White/${entry.category}/${entry.friendlyName}.png`, toSvg(white))
}

progress.stop()