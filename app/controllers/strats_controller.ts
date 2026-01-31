import type { HttpContext } from '@adonisjs/core/http'
import Map from '#models/map'
import StratBook from '#models/strat_book'
import StratImage from '#models/strat_image'
import { createStratValidator, updateStratValidator } from '#validators/strat_validator'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import * as fs from 'node:fs'
import * as path from 'node:path'

export default class StratsController {
  async index({ view }: HttpContext) {
    const maps = await Map.query().where('isActive', true).orderBy('name', 'asc')
    return view.render('pages/strats/index', { maps })
  }

  async showMap({ params, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()

    const strats = await StratBook.query()
      .where('mapId', map.id)
      .preload('images')
      .orderBy('sortOrder', 'asc')

    return view.render('pages/strats/map', { map, strats })
  }

  async create({ params, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    return view.render('pages/strats/create', { map })
  }

  async store({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const data = await request.validateUsing(createStratValidator)

    const maxOrder = await StratBook.query()
      .where('mapId', map.id)
      .max('sort_order as maxOrder')
      .first()

    await StratBook.create({
      mapId: map.id,
      title: data.title,
      description: data.description || null,
      valoplantUrl: data.valoplantUrl || null,
      sortOrder: (maxOrder?.$extras.maxOrder || 0) + 1,
    })

    session.flash('success', 'Strat created successfully')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async edit({ params, view }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const strat = await StratBook.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .preload('images')
      .firstOrFail()

    return view.render('pages/strats/edit', { map, strat })
  }

  async update({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const strat = await StratBook.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .firstOrFail()

    const data = await request.validateUsing(updateStratValidator)

    strat.title = data.title
    strat.description = data.description || null
    strat.valoplantUrl = data.valoplantUrl || null
    await strat.save()

    session.flash('success', 'Strat updated successfully')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async destroy({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const strat = await StratBook.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .preload('images')
      .firstOrFail()

    // Delete associated images from filesystem
    const uploadsDir = app.makePath('storage/uploads/strats')
    for (const image of strat.images) {
      const filePath = path.join(uploadsDir, image.filename)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    await strat.delete()

    if (request.header('HX-Request')) {
      return response.send('')
    }

    session.flash('success', 'Strat deleted successfully')
    return response.redirect(`/strats/${params.mapSlug}`)
  }

  async uploadImage({ params, request, response, session }: HttpContext) {
    const map = await Map.query().where('slug', params.mapSlug).firstOrFail()
    const strat = await StratBook.query()
      .where('id', params.id)
      .where('mapId', map.id)
      .firstOrFail()

    const image = request.file('image', {
      size: '5mb',
      extnames: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    })

    if (!image) {
      session.flash('error', 'Please select an image to upload')
      return response.redirect(`/strats/${params.mapSlug}/${params.id}/edit`)
    }

    if (!image.isValid) {
      session.flash('error', image.errors[0]?.message || 'Invalid image')
      return response.redirect(`/strats/${params.mapSlug}/${params.id}/edit`)
    }

    const filename = `${cuid()}.${image.extname}`
    const uploadsDir = app.makePath('storage/uploads/strats')

    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    await image.move(uploadsDir, { name: filename })

    const maxOrder = await StratImage.query()
      .where('stratBookId', strat.id)
      .max('sort_order as maxOrder')
      .first()

    await StratImage.create({
      stratBookId: strat.id,
      filename,
      originalName: image.clientName,
      sortOrder: (maxOrder?.$extras.maxOrder || 0) + 1,
    })

    session.flash('success', 'Image uploaded successfully')
    return response.redirect(`/strats/${params.mapSlug}/${params.id}/edit`)
  }

  async deleteImage({ params, request, response, session }: HttpContext) {
    const image = await StratImage.findOrFail(params.id)

    // Delete from filesystem
    const uploadsDir = app.makePath('storage/uploads/strats')
    const filePath = path.join(uploadsDir, image.filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    await image.delete()

    if (request.header('HX-Request')) {
      return response.send('')
    }

    session.flash('success', 'Image deleted successfully')
    return response.redirect().back()
  }
}
