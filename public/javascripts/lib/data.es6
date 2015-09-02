class SingularResource {

  constructor(source) {
    this._source = source
  }

  update(data) {
    this._data = data
    this._source.createLookupsFor(this)
  }

  get source() {
    return this._source
  }

  get data() {
    return this._data
  }

  get key() {
    return this.source.convertTypeAndIdToKey(this.data.type, this.data.id)
  }

  get uri() {
    return this.data.links.self
  }

  get related() {
    let related = {}
    for(let name in this.data.relationships) {
      let rel = this.data.relationships[name]
      if(rel.data != null) {
        if(rel.data instanceof Array) {
          related[name] = rel.data.map(x => this.source.findByTypeAndId(x.type, x.id))
        } else {
          related[name] = this.source.findByTypeAndId(rel.data.type, rel.data.id)
        }
      }
    }
    return related
  }
}

export default class Data {

  constructor() {
    this._keys = {}
    this._uris = {}
  }

  parse(data) {
    this.processResources(data.data)
    if(data.included != null) {
      this.processResources(data.included)
    }
    console.log(this)
  }

  processResources(data) {
    if(!(data instanceof Array)) {
      data = [data]
    }
    data.forEach(this.updateSingularResource.bind(this))
  }

  updateSingularResource(data) {
    (new SingularResource(this)).update(data)
  }

  createLookupsFor(singularResource) {
    this._keys[singularResource.key] = singularResource
    this._uris[singularResource.uri] = singularResource.key
  }

  convertTypeAndIdToKey(type, id) {
    return `${type}/${id}`
  }

  findByTypeAndId(type, id) {
    return this.findByKey(this.convertTypeAndIdToKey(type, id))
  }

  findByKey(key) {
    return this._keys[key]
  }

  findByURI(uri) {
    let key = this._uris[uri]
    if(key == null) {
      return null
    }
    return this.findByKey(key)
  }

  test() {
    let updateOperation = {
      'orgs/1': {
        attributes: {
          name: {
            $set: 'Revelry'
          }
        },
        relationships: {
          contacts: {
            $remove: ['contacts/1'],
            $add: ['contacts/2']
          }
        }
      },
      'contacts/1': {
        attributes: {
          name: {
            $set: 'Joel',
          },
          email: {
            $set: 'joel@revelry.co'
          }
        }
      }
    }
    let fetchOperation = {
      'orgs/1': {
        attributes: [name],
        relationships: {
          contacts: {
            name: true,
            email: true
          }
        }
      }
    }
  }
}
