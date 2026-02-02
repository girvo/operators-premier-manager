import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Map from '#models/map'

export default class MapsSeeder extends BaseSeeder {
  async run() {
    const maps = [
      { name: 'Ascent', slug: 'ascent', isActive: true },
      { name: 'Bind', slug: 'bind', isActive: true },
      { name: 'Breeze', slug: 'breeze', isActive: false },
      { name: 'Fracture', slug: 'fracture', isActive: false },
      { name: 'Haven', slug: 'haven', isActive: true },
      { name: 'Icebox', slug: 'icebox', isActive: true },
      { name: 'Lotus', slug: 'lotus', isActive: true },
      { name: 'Pearl', slug: 'pearl', isActive: false },
      { name: 'Split', slug: 'split', isActive: true },
      { name: 'Sunset', slug: 'sunset', isActive: true },
      { name: 'Abyss', slug: 'abyss', isActive: true },
      { name: 'Corrode', slug: 'corrode', isActive: true },
    ]

    for (const map of maps) {
      await Map.updateOrCreate({ slug: map.slug }, map)
    }
  }
}
